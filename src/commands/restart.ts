import {Command} from '@oclif/core'

import {checkProject} from "../checks/check-project.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {nodeService} from "../services/node-service.js";
import {clm} from "../clm.js";

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
        clm.preStep('Stopping the node...');
        await dockerHelper.dockerDown();
        clm.preStep('Checking for a new version...');
        await checkProject.runUpgrade(); // checks for a new version
        clm.preStep('Starting the node...');
        await dockerHelper.dockerUp();
    }
}
