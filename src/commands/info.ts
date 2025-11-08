import {Command} from '@oclif/core'

import packageJson from '../../package.json' with {type: 'json'};
import {checkNodePilot} from "../checks/check-pilot.js";
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
        const {CL_DOCKER_JAVA_OPTS} = configStore.getEnvLayerInfo(networkInfo.type, 'gl0');

        // Project Name
        configHelper.showEnvInfo('Project Name', projectInfo.name);

        // Pilot Version
        configHelper.showEnvInfo('Node Pilot Version', packageJson.version);

        // External IP Address
        configHelper.showEnvInfo('External IP Address', currentIpAddress);

        // DAG Address
        configHelper.showEnvInfo('DAG Address', projectInfo.dagAddress);

        // Node ID
        configHelper.showEnvInfo('Node ID', projectInfo.nodeId);

        // Layers to Run
        configHelper.showEnvInfo('Layers to Run', projectInfo.layersToRun?.join(', '));

        // Network type
        configHelper.showEnvInfo('Network', networkInfo.type);

        // Network version
        configHelper.showEnvInfo('Network Version', networkInfo.version);

        // Java Memory
        configHelper.showEnvInfo('GL0 Java Opts', CL_DOCKER_JAVA_OPTS);

        // Project Directory
        configHelper.showEnvInfo('Project Directory', projectInfo.projectDir);

        // Fast Forward
        // configHelper.showEnvInfo('Fast Forward Enabled', (projectInfo.fastForward === undefined || Boolean(projectInfo.fastForward)).toString());

        // Discord alerts
        configHelper.showEnvInfo('Discord Alerts Enabled', checkNodePilot.isDiscordAlertsEnabled().toString());
    }
}
