import {Args, Command, Flags} from '@oclif/core'

import {checkProject} from "../checks/check-project.js";
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {pilotManager} from "../helpers/pilot-manager.js";
import {serviceLog} from "../helpers/service-log.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";
import {TessellationLayer} from "../types.js";

export default class Restart extends Command {
    static override args = {
        layer: Args.string({description: 'network layer to restart. e.g. gl0'}),
    }
    static override description = 'A full shutdown of the validator node, then restart'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    static override flags = {
        autostart: Flags.boolean({description: 'restart each running project if it has been stopped'}),
        update: Flags.boolean({description: 'update each project if a new version is available'}),
    }

    public async run(): Promise<void> {
        const {args, flags} = await this.parse(Restart);

        configHelper.assertProject('No project found. ');

        if (flags.update) {
            serviceLog.log('Executing "cpilot restart --update" at ' + new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
            this.setIsRestarting(true);
            const project = pilotManager.getActiveProject();
            const activeProjects = pilotManager.getRunningProjects();
            for (const project of activeProjects) {
                pilotManager.setActiveProject(project);
                // eslint-disable-next-line no-await-in-loop
                if(await checkProject.hasVersionChanged()) {
                    serviceLog.log('    ' + project + ' version has changed. Restarting...');
                    // eslint-disable-next-line no-await-in-loop
                    await this.restart();
                }
                else {
                    serviceLog.log('    ' + project + ' version is the same. ');
                }
            }

            pilotManager.setActiveProject(project);
            this.setIsRestarting(false);
            return;
        }

        if (flags.autostart) {
            serviceLog.log('Executing "cpilot restart --autostart" at ' + new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
            this.setIsRestarting(true);
            const project = pilotManager.getActiveProject();
            const activeProjects = pilotManager.getRunningProjects();
            for (const project of activeProjects) {
                serviceLog.log('    ' + project + ' is being auto started...');
                pilotManager.setActiveProject(project);
                // eslint-disable-next-line no-await-in-loop
                await this.restart();
            }

            pilotManager.setActiveProject(project);
            this.setIsRestarting(false);
            return;
        }

        if (!await dockerService.isRunning()) {
            this.error('The validator node is not running.');
        }

        if (args && args.layer) {
            const {layersToRun} = configStore.getProjectInfo();
            const layer = args.layer as TessellationLayer;
            if (!layersToRun.includes(layer)) {
                this.error(`Invalid layer: ${layer}. Available layers: ${layersToRun.join(',')}`);
            }

            await nodeService.leaveCluster(layer);
            await nodeService.pollForLayersState([layer], 'Offline');
            clm.preStep(`Restarting ${layer.toUpperCase()}...`);
            await dockerService.dockerRestart(layer);
            return;
        }

        await this.restart();
    }

    private async restart() {

        if (await dockerService.isRunning()) {
            await nodeService.leaveClusterAllLayers();
            const {layersToRun} = configStore.getProjectInfo();
            await nodeService.pollForLayersState(layersToRun, 'Offline');
            clm.preStep('Stopping the node...');
            await dockerService.dockerDown();
        }

        clm.preStep('Checking for a new version...');
        // await checkNodePilot.runUpgrade();
        await checkProject.runUpgrade();
        clm.preStep('Starting the node...');
        await dockerService.dockerRestartAll();
    }

    private setIsRestarting(val: boolean) {
        if (val) {
            if (pilotManager.isRestarting()) {
                serviceLog.log('Restart already ACTIVE')
                process.exit(0);
            }

            process.on("exit", () => {
                // serviceLog.log('exiting, clearing isRestarting flag');
                pilotManager.setIsRestarting(0);
            });

            pilotManager.setIsRestarting(Date.now());
        }
        else {
            pilotManager.setIsRestarting(0);
        }
    }

}
