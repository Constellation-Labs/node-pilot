import {input, select} from "@inquirer/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {clusterService} from "../services/cluster-service.js";
import {dockerService} from "../services/docker-service.js";
import {shellService} from "../services/shell-service.js";

// Node ids are 128 hex chars, but the upstream lists occasionally carry a slightly
// shorter id (a leading zero stripped during generation), so don't hard-require 128 —
// just "a long hex token". This is only used to tell a real seed list apart from an
// HTML/XML error page or other garbage, not to validate individual ids.
const SEED_LIST_LINE_REGEX = /^[\da-f]{100,}$/i;

function seedListEntries(text: string): string[] {
    return text.split('\n').map(line => line.trim()).filter(Boolean);
}

// A seed list we trust enough to act on a *negative* result: non-empty and every line
// looks like a node id. Rejects HTML/XML error bodies, empty bodies, and responses
// truncated mid-line. Without this a flaky S3 response could hard-exit a node that is
// actually enrolled.
function isCompleteSeedList(text: string): boolean {
    const entries = seedListEntries(text);
    return entries.length > 0 && entries.every(entry => SEED_LIST_LINE_REGEX.test(entry));
}

// Fetch the seed list, returning '' unless we got a complete, untruncated list. Retries
// once to ride out a transient blip before the caller falls back to the local copy.
async function fetchCompleteSeedList(url: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
        // eslint-disable-next-line no-await-in-loop
        const body = await fetch(url)
            .then(async res => {
                if (!res.ok) return '';
                const text = await res.text();
                // guard against a truncated transfer: fewer bytes than declared. A larger
                // body (e.g. a decompressed gzip response) is fine, so only flag shortfalls.
                const declaredLength = Number(res.headers.get('content-length'));
                if (declaredLength && Buffer.byteLength(text) < declaredLength) return '';
                return text;
            })
            .catch(() => '');

        if (isCompleteSeedList(body)) return body;
    }

    return '';
}

export const checkNetwork = {

    checkExternalIpAddress() {
        const {CL_EXTERNAL_IP} = configStore.getEnvInfo();
        if (!CL_EXTERNAL_IP) {
            return this.configureIpAddress();
        }
    },

    async checkForExistingNodeIdInCluster() {

        // if(configStore.hasProjectFlag('duplicateNodeIdChecked')) {
        //     return;
        // }

        clm.preStep('Checking for existing Node ID in cluster...');

        const {nodeId} = configStore.getProjectInfo();

        const clusterInfo = await clusterService.getClusterInfo();
        const found = clusterInfo.some(node => node.id === nodeId);
        const isDockerRunning = await dockerService.isRunning();

        if (!isDockerRunning && found) {
            clm.warn('Node ID already exists in the cluster.');
            clm.warn('You need to shutdown your node from a previous installation before continuing.');
            clm.warn('If you recently left the cluster, you may need to wait for your Node Id to be cleared. ~1 minute');
            clm.error(`Or to change the node ID, configure the Key File: use ${chalk.cyan('cpilot config')}, and select ${chalk.cyan('Key File')}`);
        }

        // configStore.setProjectFlag('duplicateNodeIdChecked', true);
        clm.postStep('✅ No duplicate Node found.');
    },

    async checkSeedList() {
        // Seed list membership is dynamic — the upstream lists (especially testnet /
        // integrationnet) get rotated and nodes can be dropped. Re-validate on every run
        // instead of trusting a cached "passed" flag, otherwise a node that was removed
        // upstream keeps launching and only gets rejected later by the protocol.
        const { type } = configStore.getNetworkInfo();
        const { nodeId, projectDir } = configStore.getProjectInfo();
        const seedListFile = path.resolve(projectDir, 'seedlist');

        clm.preStep(`Checking inclusion into seed list for ${type.toUpperCase()} network...`);

        const localSeedList = () => fs.existsSync(seedListFile) ? fs.readFileSync(seedListFile, 'utf8') : '';
        const isEnrolled = (list: string) => seedListEntries(list).includes(nodeId);

        // Hard-exits on purpose: the protocol enforces the seed list, so without this the
        // node would just fail to connect with no explanation.
        const printNotFoundError = () => {
            clm.warn(`Node ID not found in ${type.toUpperCase()} seed list. You may try again later.`);
            clm.warn(`To change the Key File: use ${chalk.cyan('cpilot config')}, and select ${chalk.cyan('Key File')}`);
            clm.error(`To change the Network: use ${chalk.cyan('cpilot config')}, and select ${chalk.cyan('Network')}`);
        }

        if (type === 'mainnet') {
            // the mainnet seed list ships with the network release (install.sh always writes
            // the local file), so the local copy is authoritative.
            if (isEnrolled(localSeedList())) {
                clm.postStep(`✅ Node ID found in ${type.toUpperCase()} seed list.`);
                return;
            }

            printNotFoundError();
            return;
        }

        // testnet / integrationnet: the S3 list is authoritative and rotates over time.
        // Only act on a *negative* when we obtained a complete list — a partial or failed
        // fetch must not hard-exit a node that is actually enrolled.
        const url = `https://constellationlabs-dag.s3.us-west-1.amazonaws.com/${type}-seedlist`
        const remoteSeedList = await fetchCompleteSeedList(url);

        if (remoteSeedList) {
            if (isEnrolled(remoteSeedList)) {
                // refresh the seed list the node mounts so it stays current
                fs.writeFileSync(seedListFile, remoteSeedList);
                clm.postStep(`✅ Node ID found in ${type.toUpperCase()} seed list.`);
                return;
            }

            printNotFoundError();
            return;
        }

        // Could not obtain a trustworthy remote list — fall back to the local copy the node
        // mounts rather than hard-exiting on an unverified result.
        clm.warn(`Could not fetch a complete ${type.toUpperCase()} seed list from ${url}. Falling back to local copy.`);
        if (isEnrolled(localSeedList())) {
            clm.postStep(`✅ Node ID found in local ${type.toUpperCase()} seed list.`);
            return;
        }

        printNotFoundError();
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

        const {type} = configStore.getNetworkInfo();

        return clusterService.getClusterInfo()
            .then(async nodes =>  {

                clm.debug(`${type} is live. Found ${nodes.length} nodes in the cluster.`);

                configStore.setClusterStats({ total: nodes.length });

                return true;
            })
            .catch(() => false);
    }
}