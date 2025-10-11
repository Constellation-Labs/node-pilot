import {Command} from '@oclif/core'

import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";

export default class Info extends Command {

    static override description = 'Display general info about the validator node'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]

    public async run(): Promise<void> {
        configHelper.assertProject('No project info found. ');

        const projectInfo = configStore.getProjectInfo();
        const networkInfo = configStore.getNetworkInfo();
        const {CL_EXTERNAL_IP: currentIpAddress} = configStore.getEnvInfo();

        // Project Name
        configHelper.showEnvInfo('Project Name', projectInfo.name);

        // DAG Address
        configHelper.showEnvInfo('DAG Address', projectInfo.dagAddress);

        // External IP Address
        configHelper.showEnvInfo('External IP Address', currentIpAddress);

        // Node ID
        configHelper.showEnvInfo('Node ID', projectInfo.nodeId);

        // Layers to Run
        configHelper.showEnvInfo('Layers to Run', projectInfo.layersToRun?.join(', '));

        // Network type
        configHelper.showEnvInfo('Network', networkInfo.type);

        // Network version
        configHelper.showEnvInfo('Network Version', networkInfo.version);

        // Project Directory
        configHelper.showEnvInfo('Project Directory', projectInfo.projectDir);

        // Fast Forward
        configHelper.showEnvInfo('Fast Forward Enabled', (projectInfo.fastForward === undefined || Boolean(projectInfo.fastForward)).toString());
    }
}
