import {Args, Flags} from '@oclif/core'

import {BaseCommand} from "../base-command.js";
import {checkProject} from "../checks/check-project.js";
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {serviceLog} from "../helpers/service-log.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";
import {TessellationLayer} from "../types.js";

export default class Restart extends BaseCommand {
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
        this.checkProject(flags);

        configHelper.assertProject('No project found. ');

        if (flags.update) {
            serviceLog.log('Executing "cpilot restart --update" at ' + new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
            const project = configStore.getActiveProject();
            const activeProjects = configStore.getRunningProjects();
            // serviceLog.log(`    Active projects: ${activeProjects.join(', ')}...`);
            for (const project of activeProjects) {
                configStore.setActiveProject(project);
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

            configStore.setActiveProject(project);
            return;
        }

        if (flags.autostart) {
            serviceLog.log('Executing "cpilot restart --autostart" at ' + new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
            const project = configStore.getActiveProject();
            const activeProjects = configStore.getRunningProjects();
            // serviceLog.log(`    Active projects: ${activeProjects.join(', ')}...`);
            for (const project of activeProjects) {
                serviceLog.log('    ' + project + ' is being auto started...');
                configStore.setActiveProject(project);
                // eslint-disable-next-line no-await-in-loop
                await this.restart();
            }

            configStore.setActiveProject(project);
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
        // const pAll = layersToRun.map(l => nodeService.getNodeInfo(l));
        // const info = await Promise.all(pAll);
        // const isRunning = info.some(n => n.state !== 'Unavailable');
        const startRestarted = configStore.isRestarting();
        if (startRestarted && (startRestarted + 1000 * 60 * 5 > Date.now())) {
            serviceLog.log('Restart already ACTIVE')
            return;
        }

        configStore.setIsRestarting(Date.now());
        try {
            if (await dockerService.isRunning()) {
                await nodeService.leaveClusterAllLayers();
                const {layersToRun} = configStore.getProjectInfo();
                await nodeService.pollForLayersState(layersToRun, 'Offline');
                clm.preStep('Stopping the node...');
                serviceLog.log('Stopping the node...');
                await dockerService.dockerDown();
            }

            clm.preStep('Checking for a new version...');
            serviceLog.log('Checking for a new version...');
            await checkProject.runUpgrade();
            clm.preStep('Starting the node...');
            serviceLog.log('Starting the node...');
            await dockerService.dockerRestartAll();
        }
        finally {
            configStore.setIsRestarting(0);
        }
    }

}
