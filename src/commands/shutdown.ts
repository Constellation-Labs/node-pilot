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

    public async run(): Promise<void> {
        configHelper.assertProject('No project found. ');
        const {layersToRun} = configStore.getProjectInfo();
        await nodeService.leaveClusterAllLayers();
        await nodeService.pollForLayersState(layersToRun, 'Offline');
        await dockerService.dockerDown();
    }
}
