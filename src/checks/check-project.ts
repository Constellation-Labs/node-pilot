import {input, select} from "@inquirer/prompts";
import ora, {Ora} from 'ora';

import {clm} from "../clm.js";
import {configStore, NetworkType} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {clusterService} from "../services/cluster-service.js";
import {shellService} from "../services/shell-service.js";
import {checkNetwork} from "./check-network.js";

export const checkProject = {

    async projectInstallation() {

        let updateNetworkType = false;
        let updateLayers = false;

        if (!configStore.hasProjects() || process.env.PILOT_ENV === 'test') {
            await projectHelper.selectProject();
            await checkNetwork.configureIpAddress();
            updateNetworkType = true;
            updateLayers = true;
        }

        const { layersToRun } = configStore.getProjectInfo();
        const { type } = configStore.getNetworkInfo();

        if (!type || updateNetworkType) {
            await promptHelper.selectNetwork();
            updateLayers = true;
        }

        if (!layersToRun || updateLayers) {
            await promptHelper.selectLayers();
            await promptHelper.configureJavaMemoryArguments();
        }
    },
    async releaseVersion() {

        const nInfo = configStore.getNetworkInfo();

        if (!nInfo.type) {
            await this.projectInstallation();
        }

        let requiresInstall = false;

        const rInfo = await configHelper.getReleaseInfo();

        if (!rInfo) {
            requiresInstall = true;
        }
        else if (rInfo.network !== nInfo.type) {
            clm.preStep(`Network type has changed between user configuration and the node installation`);
            const selectedNetwork = await select({
                choices: [
                    {name: `Keep current (${rInfo.network})`, value: rInfo.network},
                    {name: `Switch to ${nInfo.type}`, value: nInfo.type}
                ],
                message: 'Select network type:'
            });
            configStore.setNetworkInfo({
                type: selectedNetwork as NetworkType,
                version: selectedNetwork === rInfo.network ? rInfo.version : nInfo.version
            });
            if (selectedNetwork !== rInfo.network) {
                requiresInstall = true;
            }
        }
        else if (rInfo.version !== nInfo.version) {
            configStore.setNetworkInfo({ type: rInfo.network, version: rInfo.version });
        }

        const clusterVersion = await clusterService.getReleaseVersion();

        if (!requiresInstall) {
            const nInfo = configStore.getNetworkInfo();
            if (nInfo.version !== clusterVersion) {
                const answer = await input({
                    default: 'y',
                    message: `A new required network version has been detected. Do you want to upgrade now? (y/n): `
                });
                if (answer !== 'y') {
                    process.exit(0);
                }

                requiresInstall = true;
            }
        }

        if (requiresInstall) {
            await this.runInstall();
        }
    },

    async runInstall() {
        const nInfo = configStore.getNetworkInfo();
        const clusterVersion = await clusterService.getReleaseVersion();

        let rInfo = await configHelper.getReleaseInfo();

        if (rInfo && rInfo.network === nInfo.type && rInfo.version === clusterVersion) {
            clm.postStep(`Network files are already installed for ${nInfo.type} version ${clusterVersion}`);
            return false;
        }

        const isRunning = await dockerHelper.isRunning();

        if (isRunning) {
            await dockerHelper.dockerDown();
        }



        const silent = !process.env.DEBUG;

        const spinner = ora('Running install script...');

        if (silent) {
            spinner.start();
            spinner.color = 'green';
        }
        else {
            clm.preStep('Running install script...');
        }

        // NOTE: may be different for metagraphs
        await shellService.runProjectCommand(`scripts/install.sh ${nInfo.type}`, undefined, silent)
            .catch(() => {
                spinner.stop();
                clm.error('Install script failed. Please run cpilot again after correcting the error');
            });

        if (silent) {
            spinner.stop();
        }

        rInfo = await configHelper.getReleaseInfo();

        configStore.setNetworkInfo({
            type: rInfo!.network as NetworkType,
            version: rInfo!.version
        });

        return true;
    },

    async runUpgrade() {
        const changed = await this.runInstall();

        if (changed) {
            await dockerHelper.dockerBuild();
        }
    }
}