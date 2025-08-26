
import { select } from '@inquirer/prompts';
import {Command} from '@oclif/core'

import {checkNetwork} from "../checks/check-network.js";
import {checkProject} from "../checks/check-project.js";
import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";

export default class Config extends Command {

    static override description = 'Update configuration settings'
    static override examples = [
        '<%= config.bin %> <%= command.id %>'
    ]

    public async run(): Promise<void> {
        configHelper.assertProject('No configuration found. ');

        let {name} = configStore.getProjectInfo();

        name = name.charAt(0).toUpperCase() + name.slice(1);

        const answer = await select({
            choices: [
                { name: 'Auto Restart', value: 'autoRestart' },
                { name: 'External IP Address', value: 'externalIp' },
                { name: 'Java Memory', value: 'javaMemory' },
                { name: 'Key File', value: 'keyFile' },
                { name: `${name} - Layers To Run`, value: 'layersToRun' },
                { name: `Network (mainnet, testnet or intnet)`, value: 'network' },
            ],
            message: 'What would you like to change?:',
        });

        // eslint-disable-next-line unicorn/prefer-switch
        if (answer === 'autoRestart') {
            await promptHelper.configureAutoRestart();
        }
        else if (answer === 'externalIp') {
            await checkNetwork.configureIpAddress();
        }
        else if (answer === 'javaMemory') {
            await promptHelper.configureJavaMemoryArguments();
        }
        else if (answer === 'keyFile') {
            await keyFileHelper.showKeyFileInfo();
            await keyFileHelper.promptForKeyFile();
        }
        else if (answer === 'layersToRun') {
            await promptHelper.selectLayers();
            await promptHelper.configureJavaMemoryArguments();
        }
        else if (answer === 'network') {
            await promptHelper.selectNetwork();
            await checkProject.runInstall();
        }

    }

}
