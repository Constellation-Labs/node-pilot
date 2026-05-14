
import {select} from '@inquirer/prompts';
import {Command} from '@oclif/core'

import {checkNetwork} from "../checks/check-network.js";
import {checkNodePilot} from "../checks/check-pilot.js";
import {checkProject} from "../checks/check-project.js";
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {delegatedStakingService} from "../services/delegated-staking-service.js";

export default class Config extends Command {

    static override description = 'Update configuration settings'
    static override examples = [
        '<%= config.bin %> <%= command.id %>'
    ]

    public async run(): Promise<void> {
        configHelper.assertProject('No configuration found. ');

        // let {name} = configStore.getProjectInfo();
        // name = name.charAt(0).toUpperCase() + name.slice(1);

        const answer = await select({
            choices: [
                { name: 'Key File', value: 'keyFile' },
                { name: 'Java Memory', value: 'javaMemory' },
                { name: `Discord Alerts`, value: 'discordAlerts' },
                { name: `Delegated Staking`, value: 'delegatedStaking' },
                { name: 'Layers To Run', value: 'layersToRun' },
                { name: 'Constellation Network', value: 'network' },
                { name: 'External IP Address', value: 'externalIp' },
                { name: 'Container Ports', value: 'ports' },
            ],
            message: 'What would you like to change?:',
        });

        // eslint-disable-next-line unicorn/prefer-switch
        if (answer === 'externalIp') {
            await checkNetwork.configureIpAddress();
        }
        else if (answer === 'discordAlerts') {
            await checkNodePilot.promptDiscordRegistration();
        }
        else if (answer === 'delegatedStaking') {
            await delegatedStakingService.configureNodeParams();
        }
        else if (answer === 'ports') {
            await promptHelper.configurePorts();
            projectHelper.updateDockerEnv();;
        }
        else if (answer === 'javaMemory') {
            await promptHelper.shutdownNodeIfRunning();
            await checkProject.configureJavaMemoryArguments();
        }
        else if (answer === 'keyFile') {
            await promptHelper.shutdownNodeIfRunning();
            await keyFileHelper.showKeyFileInfo();
            await keyFileHelper.promptForKeyFile();
        }
        else if (answer === 'layersToRun') {
            await promptHelper.shutdownNodeIfRunning();
            await promptHelper.selectLayers();
            await checkProject.configureJavaMemoryArguments();
            projectHelper.updateDockerEnv();
        }
        else if (answer === 'network') {
            clm.warn('Changing the network will DELETE all the data and logs from the validator node.');
            await promptHelper.doYouWishToContinue();
            const {layersToRun} = configStore.getProjectInfo();
            await projectHelper.cleanup(layersToRun,true,true,true)
            await promptHelper.selectNetwork();
            projectHelper.updateDockerEnv();
            await checkNodePilot.checkVersion(); // each network may have its own release
            await checkProject.runInstall();
        }

    }

}


