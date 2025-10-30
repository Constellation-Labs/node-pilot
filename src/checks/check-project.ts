import {input, number, select} from "@inquirer/prompts";
import os from "node:os";

import {clm} from "../clm.js";
import {configStore, NetworkType} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {clusterService} from "../services/cluster-service.js";
import {dockerService} from "../services/docker-service.js";
import {shellService} from "../services/shell-service.js";
import {checkNetwork} from "./check-network.js";

function getJavaMemoryOptions(mem: number) {
    const linuxOpt = (os.platform() === 'linux') ? ' -XX:+UseZGC' : '';
    return `-Xms${mem}g -Xmx${mem}g -XX:+UnlockExperimentalVMOptions${linuxOpt} -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=./heap_dumps/ -XX:+ExitOnOutOfMemoryError`;
}

export const checkProject = {

    async checkJavaMemory() {

        if(configStore.hasProjectFlag('javaMemoryChecked')) {
            return;
        }

        await this.configureJavaMemoryArguments();
    },

    async configureJavaMemoryArguments() {
        const {memory} = configStore.getSystemInfo();
        const {layersToRun, name} = configStore.getProjectInfo();
        const {type: currentNetwork} = configStore.getNetworkInfo();

        const xmx = Number(memory);

        if (xmx === 8 && layersToRun.length > 1) {
            clm.warn('Minimum 8GB memory detected. Only a single layer will be allowed to run');
            await promptHelper.doYouWishToContinue();
            configStore.setProjectInfo({layersToRun: [layersToRun[0]]});
            configStore.setEnvLayerInfo(currentNetwork, layersToRun[0], { CL_DOCKER_JAVA_OPTS: '-Xms1024M -Xmx7G -Xss256K' });
        }
        else if (name === 'hypergraph') {
            // prompt to use all detected memory
            let answer = await number({
                default: xmx-1,
                message: `How much of the detected memory (${xmx}GB) do you want to use?: `,
                validate: v => v !== undefined && v >= 4 && v <= xmx
            }) as number;

            if (answer === xmx) answer--;

            let subLayerMem = 0;
            let mainLayerMem = 0;

            if (currentNetwork === 'testnet') {
                subLayerMem = layersToRun.length > 1 ? Math.floor(answer / 2) : 0;
                mainLayerMem = answer - subLayerMem;
            }
            else {
                subLayerMem = layersToRun.length > 1 ? Math.floor(answer / 3) : 0;
                mainLayerMem = answer - subLayerMem;
            }

            const {supportedTypes} = configStore.getNetworkInfo();

            for (const type of supportedTypes) {
                const network = type.toUpperCase();
                const logMethod = type === currentNetwork ? clm.postStep : clm.debug;
                logMethod(`${network}:: ${layersToRun[0]} memory allocation: ${mainLayerMem}GB`);
                configStore.setEnvLayerInfo(type, layersToRun[0], { CL_DOCKER_JAVA_OPTS: getJavaMemoryOptions(mainLayerMem) });

                if (subLayerMem) {
                    logMethod(`${network}:: ${layersToRun[1]} memory allocation: ${subLayerMem}GB`);
                    configStore.setEnvLayerInfo(type, layersToRun[1], { CL_DOCKER_JAVA_OPTS: `-Xms1024M -Xmx${subLayerMem}G -Xss256K` });
                }
            }
        }

        configStore.setProjectFlag('javaMemoryChecked', true);
    },

    async hasVersionChanged() {
        const clusterVersion = await clusterService.getReleaseVersion();

        const rInfo = await configHelper.getReleaseInfo();

        return !rInfo || (rInfo.version !== clusterVersion);
    },
    async projectInstallation() {

        let updateNetworkType = false;
        let updateLayers = false;

        if (!configStore.hasProjects()) {
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
            await this.configureJavaMemoryArguments();
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
                    message: `A new required network version has been detected. ${clusterVersion}. Do you want to upgrade now? (y/n): `
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

        const isRunning = await dockerService.isRunning();

        if (isRunning) {
            await dockerService.dockerDown();
        }

        // const silent = !process.env.DEBUG;
        //
        // const spinner = ora('');
        //
        // if (silent) {
        //     spinner.start();
        //     spinner.color = 'green';
        // }
        // else {
        if (!rInfo) {
            // First time install
            clm.preStep('Tessellation and dependencies need to be installed. This may take a few minutes...');
            await promptHelper.doYouWishToContinue();
        }
        // }

        // const node = await clusterService.getClusterNodeInfo();
        // const NODE_URL = `http://${node.host}:${node.publicPort}`;

        // NOTE: may be different for metagraphs
        await shellService.runProjectCommand(`scripts/install.sh ${nInfo.type}`, undefined, false)
            .catch(() => {
                // spinner.stop();
                // if (silent) {
                //     clm.error(`Install script failed. run: ${chalk.cyan("DEBUG=true cpilot")} for more details`);
                // }

                clm.error('Install script failed. Please run cpilot again after correcting the error');
            });

        // if (silent) {
        //     spinner.stop();
        // }

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
            await dockerService.dockerBuild();
        }
    }
}