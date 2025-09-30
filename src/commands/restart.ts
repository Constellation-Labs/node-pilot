import {Args} from '@oclif/core'

import {BaseCommand} from "../base-command.js";
import {checkProject} from "../checks/check-project.js";
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";
import {TessellationLayer} from "../types.js";

export default class Restart extends BaseCommand {
    static override args = {
        layer: Args.string({description: 'network layer to view. e.g. gl0'}),
    }
    static override description = 'A full shutdown of the validator node, then restart'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]

    public async run(): Promise<void> {
        const {args, flags} = await this.parse(Restart);
        this.checkProject(flags);

        configHelper.assertProject('No project found. ');

        const {layersToRun} = configStore.getProjectInfo();

        if (!await dockerService.isRunning()) {
            this.error('The validator node is not running.');
        }

        if (args && args.layer) {
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


        await nodeService.leaveClusterAllLayers();
        await nodeService.pollForLayersState(layersToRun, 'Offline');
        clm.preStep('Stopping the node...');
        await dockerService.dockerDown();
        clm.preStep('Checking for a new version...');
        await checkProject.runUpgrade();
        clm.preStep('Starting the node...');
        await dockerService.dockerUp();
    }

}
