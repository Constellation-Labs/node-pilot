import {input, select} from "@inquirer/prompts";

import {clm} from "../clm.js";
import {configStore, NetworkType} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {clusterService} from "../services/cluster-service.js";
import {nodeService} from "../services/node-service.js";
import {shellService} from "../services/shell-service.js";
import {checkNetwork} from "./check-network.js";

export const checkProject = {

    async projectInstallation() {

        let updateNetworkType = false;
        let updateLayers = false;

        if (!configStore.hasProjects() || process.env.PILOT_ENV === 'test') {
            await promptHelper.selectProject();
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

        const clusterVersionInfo = await clusterService.getReleaseVersion();

        if (!requiresInstall) {
            const nInfo = configStore.getNetworkInfo();
            if (nInfo.version !== clusterVersionInfo) {
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
        let rInfo = await configHelper.getReleaseInfo();

        if (rInfo && rInfo.network === nInfo.type) {
            clm.postStep(`Network files are already installed for ${nInfo.type}`);
            return false;
        }

        const nodeInfo = await nodeService.getNodeInfo('first');

        const isRunning = nodeInfo.state !== 'Unavailable';

        if (isRunning) {
            await dockerHelper.dockerDown();
        }

        const silent = !process.env.DEBUG;

        if (silent) {
            clm.preStep('Running install script...');
        }

        await shellService.runCommand(`scripts/install.sh ${nInfo.type}`, undefined, silent); // different for metagraphs

        rInfo = await configHelper.getReleaseInfo();

        configStore.setNetworkInfo({
            type: rInfo!.network as NetworkType,
            version: rInfo!.version
        });

        return true;
    },

    async runUpgrade() {
        const changed = await this.runInstall();

        if (changed && shellService.existsScript('scripts/docker-build.sh')) {
            clm.preStep('Building the node container...');
            await shellService.runCommand('bash scripts/docker-build.sh');
        }
    }
}