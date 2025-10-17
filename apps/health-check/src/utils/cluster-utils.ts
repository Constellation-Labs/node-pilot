import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {NodeInfo} from "../types.js";
import {nodeUtils} from "./node-utils.js";
import {notifyUtils} from "./notify-utils.js";
import {shellUtils} from "./shell-utils.js";
import {storeUtils} from "./store-utils.js";

export const clusterUtils = {

    async checkForSessionFork() {
        const { clusterSession } = await this.getSourceNodeInfo();
        const {clusterSession: nodeClusterSession} = storeUtils.getNodeStatusInfo();

        logger.log(`Checking for session fork.`);

        if (clusterSession !== nodeClusterSession) {
            logger.error(`Session fork detected. Current session: ${clusterSession}, Node session: ${nodeClusterSession}`);
            if (await this.hasVersionChanged()) {
                logger.log(`    Network version has changed. Waiting for auto-upgrade...`);
                const {upgrade} = storeUtils.getTimerInfo();
                if (!upgrade) {
                    storeUtils.setTimerInfo({upgrade: true});
                    notifyUtils.notify(`Network version has changed. Waiting for auto-upgrade...`);
                }

                storeUtils.setNodeStatusInfo({error: 'cluster:upgrade'});
                throw new Error('Cluster upgrade in progress.');
            }
            else {
                storeUtils.setNodeStatusInfo({error: 'cluster:forked'});
                throw new Error('RESTART_REQUIRED');
            }
        }

        // logger.log(`    Cluster and Node Session matched: ${clusterSession}`);
    },

    async checkLatestOrdinals() {
        const layer = APP_ENV.CL_TESSELATION_LAYER;

        // Not sure how to check metagraphs. Will need to revisit this.
        if (layer !== 'gl0') return;

        const ordinal = await nodeUtils.getNodeLatestOrdinal();
        const clusterOrdinal = await this.getSourceNodeLatestOrdinal();
        storeUtils.setNodeStatusInfo({ clusterOrdinal, ordinal });

        logger.log(`Checking local snapshot ${ordinal} distance from cluster: ${clusterOrdinal - ordinal}`);

        if (ordinal !== clusterOrdinal) {
            logger.log(`    Cluster: ${clusterOrdinal}`);

            const errors = await this.hasHealableErrors();

            if (errors) {
                logger.log('Detected healable errors in logs...\n    ' + errors);
                storeUtils.setNodeStatusInfo({error: 'missing snapshot'});
                await nodeUtils.leaveCluster();
                throw new Error('missing snapshot');
            }

            if (ordinal + 20 < clusterOrdinal) {
                logger.error(`Node ordinal is being left too far behind - Leaving Cluster...`);
                storeUtils.setNodeStatusInfo({error: 'lagging behind'});
                await nodeUtils.leaveCluster();
                throw new Error('lagging behind');
            }
        }

    },

    async checkLatestSnapshotHash() {

        const layer = APP_ENV.CL_TESSELATION_LAYER;

        // Not sure how to check gl1. Will need to revisit this.
        if (layer !== 'gl0') return;

        if (!APP_ENV.IS_GLOBAL_LAYER) {
            logger.log(`Health check for layer ${layer} is not implemented. Skipping snapshot hash verification.`);
            return;
        }

        let { clusterOrdinal, ordinal } = storeUtils.getNodeStatusInfo();

        if (!clusterOrdinal || !ordinal) {
            ordinal = await nodeUtils.getNodeLatestOrdinal();
            clusterOrdinal = await this.getSourceNodeLatestOrdinal();
        }

        const ordinalToCheck = Math.min(clusterOrdinal, ordinal);

        const nodeOrdinalHash = await nodeUtils.getNodeOrdinalHash(ordinalToCheck);
        const sourceNodeOrdinalHash = await this.getSourceNodeOrdinalHash(ordinalToCheck);

        logger.debug("Comparing snapshot hashes for ordinal " + ordinalToCheck);
        logger.debug("  Local : " + nodeOrdinalHash);
        logger.debug(`  Source(${APP_ENV.CL_L0_PEER_HTTP_HOST}): ${sourceNodeOrdinalHash}`);

        if (nodeOrdinalHash !== sourceNodeOrdinalHash) {
            storeUtils.setNodeStatusInfo({error: 'hash mismatch:forked'});
            await nodeUtils.leaveCluster();
            throw new Error(`Hash mismatch detected at ordinal ${ordinalToCheck} - Node: ${nodeOrdinalHash}, Source: ${sourceNodeOrdinalHash} - Leaving Cluster...`);
        }
    },

    async getClusterConsensusPeers() {
        const lbUrl = APP_ENV.CL_LB;
        if (lbUrl && APP_ENV.CL_TESSELATION_LAYER === 'gl0') {
            return fetch(`${lbUrl}/consensus/latest/peers`)
                .then(async res => {
                    const result: { key: number, peers: { ip: string }[] } = await res.json();
                    return { includesSourceNode: result.peers.some(p => p.ip.includes(APP_ENV.CL_L0_PEER_HTTP_HOST)), ordinal: result.key, peerCount: result.peers.length };
                })
                .catch(() => {
                    logger.warn(`Failed to fetch consensus/latest/peers from ${lbUrl}.`)
                    return { includesSourceNode: false, ordinal: 0, peerCount: 0 };
                })
        }

        return { includesSourceNode: false, ordinal: -1, peerCount: -1 };
    },

    async getClusterLatestOrdinal(): Promise<number> {
        const lbUrl = APP_ENV.CL_LB;
        if (lbUrl) {
            return fetch(`${lbUrl}/${APP_ENV.SNAPSHOT_URL_PATH}/latest`)
                .then(res => res.json())
                .then(i => i.value.ordinal)
                .catch(() => {
                    logger.warn(`Failed to fetch node info from ${lbUrl}. Falling back to source node.`);
                    return this.getSourceNodeLatestOrdinal();
                })
        }

        return this.getSourceNodeLatestOrdinal();
    },

    async getClusterNodeInfo(): Promise<NodeInfo> {
        const lbUrl = APP_ENV.CL_LB;
        if (lbUrl) {
            return fetch(`${lbUrl}/node/info?sticky=false`)
                .then(res => res.json())
                .catch(() => {
                    logger.warn(`Failed to fetch node info from ${lbUrl}. Falling back to source node.`);
                    return this.getSourceNodeInfo();
                })
        }

        return this.getSourceNodeInfo();
    },

    async getLatestDownloadedSnapshot() {
        const logFile = path.join(APP_ENV.PATH_LOGS, 'app.log');
        try {
            // Use awk to extract the value after 'value=' and before '}'
            const cmd = `tail -n 500 ${logFile} | grep '), ordinal=SnapshotOrdinal{value=' | awk -F'value=|}' '{print $2}'`;
            const output = await shellUtils.runCommandWithOutput(cmd);
            if (!output) return null;
            // Extract all numbers, sort numerically, and return the largest
            const numbers = output.trim().split(/\r?\n/).map(line => Number.parseInt(line, 10)).filter(n => !Number.isNaN(n));
            if (numbers.length === 0) return null;
            numbers.sort((a, b) => a - b);
            return numbers.at(-1);
        } catch (error) {
            logger.error(`Failed to extract latest downloaded snapshot using awk: ${error}`);
            return null;
        }
    },

    async getReleaseVersion() {
        return this.getClusterNodeInfo().then(i => i.version);
    },

    async getSourceNodeInfo(): Promise<NodeInfo> {
        return this.makeSourceNodeRequest('node/info');
    },

    async getSourceNodeLatestOrdinal(): Promise<number> {
        return this.makeSourceNodeRequest(`${APP_ENV.SNAPSHOT_URL_PATH}/latest`).then(i => i.value.ordinal);
    },

    async getSourceNodeOrdinalHash(ordinal: number): Promise<string> {
        return this.makeSourceNodeRequest(`${APP_ENV.SNAPSHOT_URL_PATH}/${ordinal}/hash`);
    },

    async hasHealableErrors() {
        const logFile = path.join(APP_ENV.PATH_LOGS, 'app.log');

        return shellUtils.runCommandWithOutput(`grep -i 'Global snapshot not found for ordinal' ${logFile}`).catch(() => '');
    },

    async hasVersionChanged() {
        const [clusterVersion, nodeVersion] = await Promise.all([
            this.getReleaseVersion(),
            nodeUtils.getNodeVersion()
        ]);
        return nodeVersion !== clusterVersion;
    },

    async makeSourceNodeRequest(path: string) {
        return fetch(`http://${APP_ENV.CL_L0_PEER_HTTP_HOST}:${APP_ENV.CL_PUBLIC_HTTP_PORT}/${path}`)
            .then(res =>  res.json())
            .catch(() => {
                throw new Error(`Unable to connect to source node at ${APP_ENV.CL_L0_PEER_HTTP_HOST}:${APP_ENV.CL_PUBLIC_HTTP_PORT}.`);
            })
    }
}