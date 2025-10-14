import {Command, Flags} from '@oclif/core'

import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";
import {TessellationLayer} from "../types.js";

export default class Shutdown extends Command {

    static override description = 'A full shutdown of the validator node'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    static override flags = {
        layer: Flags.string({char: 'l', description: 'specify a layer to shutdown. e.g. gl0'})
    }

    public async run(): Promise<void> {
        configHelper.assertProject('No project found. ');
        const {flags} = await this.parse(Shutdown);
        const {layersToRun} = configStore.getProjectInfo();
        const layer = flags.layer as TessellationLayer;
        if (layer) {
            if(!layersToRun.includes(layer)) {
                this.error(`Invalid layer: ${layer}. Available layers: ${layersToRun.join(',')}`);
            }

            await nodeService.leaveCluster(layer);
            await nodeService.pollForLayersState([], 'Offline');
            await dockerService.dockerDown([layer]);
        }
        else {
            await nodeService.leaveClusterAllLayers();
            await nodeService.pollForLayersState(layersToRun, 'Offline');
            await dockerService.dockerDown();
        }
    }
}
