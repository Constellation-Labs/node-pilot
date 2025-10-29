import {Command} from '@oclif/core'

import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";

export default class Shutdown extends Command {

    static override description = 'A full shutdown of the validator node'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    // NOTE: To only run specific layers, need to first shutdown project, config layers, and restart
    // static override flags = {
    //     layer: Flags.string({char: 'l', description: 'specify a layer to shutdown. e.g. gl0'})
    // }

    public async run(): Promise<void> {
        configHelper.assertProject('No project found. ');
        const {layersToRun} = configStore.getProjectInfo();
        configStore.setProjectStatusToRunning(false);
        await nodeService.leaveClusterAllLayers();
        await nodeService.pollForLayersState(layersToRun, 'Offline');
        await dockerService.dockerDown();
    }
}
