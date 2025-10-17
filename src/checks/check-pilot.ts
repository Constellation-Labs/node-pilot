import {JSONStorage} from "node-localstorage";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import semver from "semver";

import packageJson from '../../package.json' with {type: 'json'};
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {dockerService} from "../services/docker-service.js";
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

        const latestVer = semver.parse(result['dist-tags'].latest);
        const currentVer = semver.parse(packageJson.version);

        if (!latestVer || !currentVer || latestVer.compare(currentVer) === 0) return;

        clm.echo(`There is a new node-pilot version available. Current version: "${currentVer.version}", Latest version: "${latestVer.version}"`);

        if (os.platform() !== 'linux') return;

        const hasMajorMinorChange = latestVer.major !== currentVer.major || latestVer.minor !== currentVer.minor;

        if (hasMajorMinorChange) {

            const dockerIsRunning = await dockerService.isRunning();

            if (dockerIsRunning) {
                clm.warn('This update requires the Node to shutdown before proceeding.');
            }

            if (await promptHelper.confirmPrompt('Do you wish to upgrade now?')) {
                if (dockerIsRunning) {
                    await dockerService.dockerDown();
                }
            }
            else {
                clm.postStep('Skipping update...');
                return;
            }
        }
        else {
            clm.preStep('This update includes a minor change. There is no need to restart your Node.');
            if(!await promptHelper.confirmPrompt('Do you wish to upgrade now?')) {
                clm.postStep('Skipping update...');
                return;
            }
        }

        clm.step('Updating Node Pilot to the latest version...');
        await shellService.runCommand(`sudo npm install -g @constellation-network/node-pilot@${latestVer.version}`);
        if (hasMajorMinorChange) {
            clm.step('Updating scripts and configuration files...');
            await projectHelper.upgradeHypergraph();
        }

        clm.postStep('Update completed. Run cpilot again to use the latest version');
        process.exit(0);
    },

    async promptDiscordRegistration() {
        const hcStorage = getHcStorage();
        const join = await promptHelper.confirmPrompt('Do you want to enable Discord notifications for your node?:');

        if (!join) {
            hcStorage.setItem('user', {webHookEnabled: false});
            clm.postStep('Discord notifications are disabled.');
            return;
        }

        // let answer = await input({
        //     default: '',
        //     message: `Provide your Discord username to have it included in the notification: `
        // });
        //
        // answer = answer.trim();
        //
        // if (answer === '') {
        //     hcStorage.setItem('user', {webHookEnabled: true});
        // }
        // else {
        //     if (answer.charAt(0) === '@') answer = answer.slice(1);
        //     hcStorage.setItem('user', {discordUser: answer.trim(), webHookEnabled: true});
        // }

        hcStorage.setItem('user', {webHookEnabled: true});

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