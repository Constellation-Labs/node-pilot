import {input} from "@inquirer/prompts";
import {JSONStorage} from "node-localstorage";
import fs from "node:fs";
import path from "node:path";

import packageJson from '../../package.json' with {type: 'json'};
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {shellService} from "../services/shell-service.js";

const REGISTRY_URL = 'https://registry.npmjs.org/';

export const checkNodePilot = {

    async checkDiscordRegistration() {

        if(configStore.hasProjectFlag('discordChecked')) {
            return;
        }

        await this.promptDiscordRegistration();

        configStore.setProjectFlag('discordChecked', true);
    },

    async checkVersion () {

        const packageUrl = new URL(encodeURIComponent(packageJson.name).replace(/^%40/, '@'), REGISTRY_URL);

        const headers = {
            accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
        };

        const result: PackageInfo = await fetch(packageUrl.toString(), {headers}).then(res => res.json()).catch(() => null);

        if (!result) {
            return;
        }

        const latestVersion = result['dist-tags'].latest;

        if (packageJson.version !== latestVersion) {
            console.log('There is a new node-pilot version available.');
            if (await promptHelper.confirmPrompt('Do you wish to upgrade now?')) {
                await shellService.runCommand('npm install -g @constellationnetwork/node-pilot@latest');
                await projectHelper.upgradeHypergraph();
                clm.postStep('Run cpilot again to use the latest version');
                process.exit(0);
            }
        }
    },

    async promptDiscordRegistration() {
        const hcStorage = getHcStorage();
        const join = await promptHelper.confirmPrompt('Do you want to enable Discord notifications for your node?:');

        if (!join) {
            hcStorage.setItem('user', {webHookEnabled: false});
            clm.postStep('Discord notifications are disabled.');
            return;
        }

        let answer = await input({
            default: '',
            message: `Provide your Discord username to have it included in the notification: `
        });

        answer = answer.trim();

        if (answer === '') {
            hcStorage.setItem('user', {webHookEnabled: true});
        }
        else {
            if (answer.charAt(0) === '@') answer = answer.slice(1);
            hcStorage.setItem('user', {discordUser: answer.trim(), webHookEnabled: true});
        }

        clm.postStep('Discord notifications are enabled.');
    }
}

function getHcStorage() {
    const {layersToRun,projectDir} = configStore.getProjectInfo();
    const layer = layersToRun[0];
    const hcPath = path.join(projectDir,layer,'data','health-check');
    if (fs.existsSync(hcPath)) {
        fs.mkdirSync(hcPath, {recursive: true});
    }

    return new JSONStorage(hcPath);
}

type PackageInfo = {
    'dist-tags': {
        latest: string;
    };
    modified: string;
}