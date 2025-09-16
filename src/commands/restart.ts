import {Args, Command} from '@oclif/core'

import {checkProject} from "../checks/check-project.js";
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {nodeService} from "../services/node-service.js";
import {TessellationLayer} from "../types.js";

export default class Restart extends Command {
    static override args = {
        layer: Args.string({description: 'network layer to view. e.g. gl0'}),
    }
    static override description = 'A full shutdown of the validator node, then restart'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]

    public async run(): Promise<void> {
        configHelper.assertProject('No project found. ');

        const {args} = await this.parse(Restart);
        const {layersToRun} = configStore.getProjectInfo();

        if (args && args.layer) {
            const layer = args.layer as TessellationLayer;
            if (!layersToRun.includes(layer)) {
                this.error(`Invalid layer: ${layer}. Available layers: ${layersToRun.join(',')}`);
            }

            await nodeService.leaveCluster(layer);
            await nodeService.pollForLayersState([layer], 'Offline');
            clm.preStep(`Restarting ${layer.toUpperCase()}...`);
            await dockerHelper.dockerRestart(layer);
            return;
        }


        await nodeService.leaveClusterAllLayers();
        await nodeService.pollForLayersState(layersToRun, 'Offline');
        clm.preStep('Stopping the node...');
        await dockerHelper.dockerDown();
        clm.preStep('Checking for a new version...');
        await checkProject.runUpgrade();
        clm.preStep('Starting the node...');
        await dockerHelper.dockerUp();
    }
}
