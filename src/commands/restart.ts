import {Command} from '@oclif/core'

import {configStore} from "../config-store.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {nodeService} from "../services/node-service.js";
import {configHelper} from "../helpers/config-helper.js";

export default class Restart extends Command {

    static override description = 'A full shutdown of the validator node, then restart'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]

    public async run(): Promise<void> {
        configHelper.assertProject('No project found. ');
        const {layersToRun} = configStore.getProjectInfo();
        await nodeService.leaveClusterAllLayers();
        await nodeService.pollForLayersState(layersToRun, 'Offline');
        await dockerHelper.dockerRestart();
    }
}
