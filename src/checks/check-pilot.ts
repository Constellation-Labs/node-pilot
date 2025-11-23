import fs from "node:fs";
import os from "node:os";
import semver from "semver";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {healthCheckConfig} from "../helpers/health-check-config.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";
import {shellService} from "../services/shell-service.js";
import {checkInitialSetup} from "./check-initial-setup.js";

const REGISTRY_URL = 'https://registry.npmjs.org/';

export const checkNodePilot = {

    async checkDiscordRegistration() {

        if(configStore.hasProjectFlag('discordChecked')) {
            return;
        }

        await this.promptDiscordRegistration();

        configStore.setProjectFlag('discordChecked', true);
    },

    async checkMultipleUsers() {

        if(configStore.hasProjectFlag('multipleUsersChecked')) {
            return;
        }

        const {currentUser, otherUsers} = await checkInitialSetup.getExistingInstallations();

        if (otherUsers.length > 0) {
            clm.warn(`Multiple users have Node Pilot installed.\n    ${currentUser} <-- current user\n    ${otherUsers.join('\n    ')}`);
            clm.error('Login and run "cpilot uninstall" to remove the extra installation(s).');
        }

        configStore.setProjectFlag('multipleUsersChecked', true);
    },

    async checkVersion () {

        const {currentVer, latestVer} = await this.compareVersions();

        if (!latestVer || !currentVer || latestVer.compare(currentVer) === 0) return;

        clm.echo(`There is a new node-pilot version available. Current version: "${currentVer.version}", Latest version: "${latestVer.version}"`);

        if (os.platform() !== 'linux') return;

        const hasMajorMinorChange = latestVer.major !== currentVer.major || latestVer.minor !== currentVer.minor;
        const dockerIsRunning = await dockerService.isRunning();

        if (hasMajorMinorChange) {

            if (dockerIsRunning) {
                clm.warn('This update requires the Node to shutdown before proceeding.');
            }

            if (await promptHelper.confirmPrompt('Do you wish to update now?')) {
                if (dockerIsRunning) {
                    const {layersToRun} = configStore.getProjectInfo();
                    await nodeService.leaveClusterAllLayers();
                    await nodeService.pollForLayersState(layersToRun, 'Offline');
                    await dockerService.dockerDown();
                }
            }
            else {
                clm.postStep('Skipping update...');
                return;
            }
        }
        else {
            if (dockerIsRunning) {
                clm.preStep('This update includes a minor change. Your Node will remain up and running during the update.');
            }
            else {
                clm.preStep('This update includes a minor change.');
            }

            if(!await promptHelper.confirmPrompt('Do you wish to update now?')) {
                clm.postStep('Skipping update...');
                return;
            }
        }

        clm.step('Updating Node Pilot to the latest version...');
        await shellService.runCommand(`sudo npm install -g @constellation-network/node-pilot@${latestVer.version}`);
        if (hasMajorMinorChange) {
            clm.step('Updating scripts and configuration files...');
            projectHelper.upgradeHypergraph();

            if (fs.existsSync('/var/run/reboot-required')) {
                clm.warn('A system update and reboot is required.');
                await promptHelper.doYouWishToContinue();
                await shellService.runCommand('sudo apt-get update && sudo apt-get upgrade -y');
                if (await promptHelper.confirmPrompt('Do you want to reboot now?')) {
                    await shellService.runCommand('sudo reboot');
                }
            }
        }

        clm.postStep('Update completed. Run cpilot again to use the latest version');
        process.exit(0);
    },

    async compareVersions() {
        const { name: pilotReleaseName, version: pilotVersion } = configStore.getPilotReleaseInfo();

        const packageUrl = new URL(encodeURIComponent(pilotReleaseName).replace(/^%40/, '@'), REGISTRY_URL);

        const headers = {
            accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
        };

        const result: PackageInfo = await fetch(packageUrl.toString(), {headers}).then(res => res.json()).catch(() => null);

        if (!result) {
            return {currentVer: undefined, latestVer: undefined};
        }

        let distTag: PackageDistTag = 'latest';

        if (pilotVersion.includes('testnet')) {
            distTag = 'testnet';
        } else if (pilotVersion.includes('omegatest')) {
            distTag = 'omegatest';
        } else if (pilotVersion.includes('intnet')) {
            distTag = 'intnet';
        }

        const latestVer = semver.parse(result['dist-tags'][distTag]);
        const currentVer = semver.parse(pilotVersion);

        if (latestVer !== null && currentVer !== null) {
            clm.debug(`Current version: ${currentVer?.version}, Latest version: ${latestVer?.version}`);
        }
        else {
            clm.warn(`Unable to resolve version from dist-tag ${distTag} - ${JSON.stringify(result['dist-tags'])}`)
        }

        return {currentVer, latestVer};
    },

    isDiscordAlertsEnabled() {
        const {webHookEnabled=false} = healthCheckConfig.getUserState();
        return webHookEnabled;
    },

    async promptDiscordRegistration() {
        const join = await promptHelper.confirmPrompt('Do you want to enable Discord notifications for your node?:');

        if (!join) {
            healthCheckConfig.setUserState({webHookEnabled: false});
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

        healthCheckConfig.setUserState({webHookEnabled: true});

        clm.postStep('Discord notifications are enabled.');
    },

    async runUpgrade() {
        const {currentVer, latestVer} = await this.compareVersions();

        if (!latestVer || !currentVer || latestVer.compare(currentVer) === 0) return;

        clm.step('Updating Node Pilot to the latest version...');
        await shellService.runCommand(`sudo npm install -g @constellation-network/node-pilot@${latestVer.version}`);

        const hasMajorMinorChange = latestVer.major !== currentVer.major || latestVer.minor !== currentVer.minor;

        if (hasMajorMinorChange) {
            clm.step('Updating scripts and configuration files...');
            projectHelper.upgradeHypergraph();
        }
    }
}


type PackageDistTag = 'intnet' | 'latest' | 'omegatest' | 'testnet';

type PackageInfo = {
    'dist-tags': Record<PackageDistTag, string>;
    modified: string;
}