
import {select} from '@inquirer/prompts';
import {Command} from '@oclif/core'

import {checkNetwork} from "../checks/check-network.js";
import {checkProject} from "../checks/check-project.js";
import {clm} from "../clm.js";
import {configHelper} from "../helpers/config-helper.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {dockerService} from "../services/docker-service.js";
import {checkNodePilot} from "../checks/check-pilot.js";

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
                { name: 'External IP Address', value: 'externalIp' },
                { name: `Discord Alerts`, value: 'discordAlerts' },
                { name: 'Java Memory', value: 'javaMemory' },
                { name: 'Key File', value: 'keyFile' },
                { name: 'Layers To Run', value: 'layersToRun' },
                { name: `Network`, value: 'network' },

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
        else if (answer === 'javaMemory') {
            await shutdownNodeIfRunning();
            await promptHelper.configureJavaMemoryArguments();
        }
        else if (answer === 'keyFile') {
            await shutdownNodeIfRunning();
            await keyFileHelper.showKeyFileInfo();
            await keyFileHelper.promptForKeyFile();
        }
        else if (answer === 'layersToRun') {
            await shutdownNodeIfRunning();
            await promptHelper.selectLayers();
            await promptHelper.configureJavaMemoryArguments();
        }
        else if (answer === 'network') {
            await shutdownNodeIfRunning();
            await promptHelper.selectNetwork();
            await checkProject.runInstall();
        }

    }

}

async function shutdownNodeIfRunning() {
    if (await dockerService.isRunning()) {
        clm.preStep('The validator node must be stopped first.')
        await promptHelper.doYouWishToContinue();
        await dockerService.dockerDown();
    }
}
