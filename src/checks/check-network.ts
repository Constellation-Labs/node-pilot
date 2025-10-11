import {input, select} from "@inquirer/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {clusterService} from "../services/cluster-service.js";
import {dockerService} from "../services/docker-service.js";
import {shellService} from "../services/shell-service.js";

export const checkNetwork = {

    checkExternalIpAddress() {
        const {CL_EXTERNAL_IP} = configStore.getEnvInfo();
        if (!CL_EXTERNAL_IP) {
            return this.configureIpAddress();
        }
    },

    async checkForExistingNodeIdInCluster() {

        if(configStore.hasProjectFlag('duplicateNodeIdChecked')) {
            return;
        }

        clm.preStep('Checking for existing Node ID in cluster...');

        const {nodeId} = configStore.getProjectInfo();

        const clusterInfo = await clusterService.getClusterInfo();
        const found = clusterInfo.some(node => node.id === nodeId);
        const isDockerRunning = await dockerService.isRunning();

        if (!isDockerRunning && found) {
            clm.warn('Node ID already exists in the cluster.');
            clm.warn('You need to shutdown your node from a previous installation before continuing.');
            clm.error(`Or to change the node ID, configure the Key File: use ${chalk.cyan('cpilot config')}, and select ${chalk.cyan('Key File')}`);
        }

        configStore.setProjectFlag('duplicateNodeIdChecked', true);
        clm.postStep('No duplicate Node found.');
    },

    async checkSeedList() {
        if(configStore.hasProjectFlag('seedListChecked')) {
            return;
        }

        const { type } = configStore.getNetworkInfo();

        clm.preStep(`Checking inclusion into seed list for ${type.toUpperCase()} network...`);
        const { nodeId, projectDir } = configStore.getProjectInfo();
        const seedListFile = path.resolve(projectDir, 'seedlist');
        if (fs.existsSync(seedListFile)) {
            const found = fs.readFileSync(seedListFile, 'utf8').includes(nodeId);
            if (found) {
                clm.postStep(`Node ID found in ${type.toUpperCase()} seed list.`);
                configStore.setProjectFlag('seedListChecked', true);
                return;
            }
        }

        const printNotFoundError = () => {
            clm.warn(`Node ID not found in ${type.toUpperCase()} seed list. You may try again later.`);
            clm.warn(`To change the Key File: use ${chalk.cyan('cpilot config')}, and select ${chalk.cyan('Key File')}`);
            clm.error(`To change the Network: use ${chalk.cyan('cpilot config')}, and select ${chalk.cyan('Network')}`);
        }

        if (type === 'mainnet') {
            // the mainnet seed list comed from a network release
            printNotFoundError();
        } else {

            const url = `https://constellationlabs-dag.s3.us-west-1.amazonaws.com/${type}-seedlist`
            const seedList = await fetch(url)
                .then(res => {
                    if (res.ok) return res.text();
                    throw new Error(`Failed`);
                })
                .catch(() => {
                    clm.error(`Failed to fetch seed list from ${url}. Try again later.`);
                    return '';
                });
            if (seedList.includes(nodeId)) {
                clm.postStep(`Node ID found in ${type.toUpperCase()} seed list.`);
                fs.writeFileSync(seedListFile, seedList);
                configStore.setProjectFlag('seedListChecked', true);
            }
            else {
                printNotFoundError();
            }
        }
    },

    async configureIpAddress() {
        const {CL_EXTERNAL_IP: currentIpAddress} = configStore.getEnvInfo();
        const detectedIpAddress = await checkNetwork.fetchIPAddress().catch(() => '');

        if (!currentIpAddress && !detectedIpAddress) {
            const newIpAddress = await checkNetwork.enterIpAddressManually();
            configStore.setEnvInfo({CL_EXTERNAL_IP: newIpAddress});
            return;
        }

        if (currentIpAddress) {
            clm.postStep("\nIP address is currently set to: " + chalk.cyan(currentIpAddress));
        }

        if(detectedIpAddress) {
            clm.postStep("\nDetected IP address: " + chalk.cyan(detectedIpAddress) + "\n");
        }

        const choices = [{
            disabled: !currentIpAddress,
            name: 'Keep current IP address',
            value: 'current'
        }, {
            disabled: !detectedIpAddress,
            name: 'Use detected IP address',
            value: 'detected'
        }, {
            name: 'Enter IP address manually:',
            value: 'manual'
        }];

        const answer = await select({ choices, message: '' });

        let selectedIpAddress = currentIpAddress;

        if (answer === 'detected') {
            selectedIpAddress = detectedIpAddress;
        }
        else if (answer === 'manual') {
            selectedIpAddress = await checkNetwork.enterIpAddressManually();
        }

        configStore.setEnvInfo({CL_EXTERNAL_IP: selectedIpAddress});
    },

    async detectExternalIpAddress () {

        const externalIp = await this.fetchIPAddress()
            .catch(error => {
                clm.warn(`Error while detecting your IP address: ${error.message}`);
                return this.enterIpAddressManually();
            })

        clm.postStep("\nExternal IP address: " + chalk.cyan(externalIp) + "\n");

        configStore.setEnvInfo({CL_EXTERNAL_IP: externalIp});
    },

    async enterIpAddressManually() {
        return input({
            message: 'Please enter the IP address manually:',
            validate(value: string) {
                // Basic validation for IP address format
                const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (ipRegex.test(value.trim())) {
                    return true;
                }

                return 'Please enter a valid IP address (e.g., 192.168.1.1)';
            }
        });
    },

    async fetchIPAddress() {
        return shellService.runCommandWithOutput('curl -4 https://ifconfig.me/ip');
    },

    async isNetworkConnectable() {

        return clusterService.getClusterInfo()
            .then(async nodes =>  {
                const someAreReady = nodes.some(node => node.state === 'Ready');
                if (!someAreReady) {
                    if (nodes.length > 0) {
                        clm.warn(`Found ${nodes.length} nodes in the cluster, but none are READY.`);
                    }

                    throw new Error(`Network is not connectable.`);
                }

                clm.debug(`Network is live. Found ${nodes.length} nodes in the cluster.`);

                configStore.setClusterStats({ total: nodes.length });

                return true;
            })
            .catch(() => {
                clm.error(`Network is not in service. Please try again later.`);
                return false;
            });
    }
}