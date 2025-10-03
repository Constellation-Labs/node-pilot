import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {NodeInfo} from "../types.js";
import {nodeUtils} from "./node-utils.js";
import {shellUtils} from "./shell-utils.js";
import {storeUtils} from "./store-utils.js";

export const clusterUtils = {

    async checkForSessionFork() {
        const { clusterSession } = await this.getSourceNodeInfo();
        const nodeStatusInfo = storeUtils.getNodeStatusInfo();

        logger.log(`Checking for session fork.`);

        if (clusterSession !== nodeStatusInfo.clusterSession) {
            logger.error(`Session fork detected. Current session: ${clusterSession}, Node session: ${nodeStatusInfo.clusterSession}`);
            throw new Error('RESTART_REQUIRED');
        }

        // logger.log(`    Cluster and Node Session matched: ${clusterSession}`);
    },

    async checkLatestOrdinals() {
        const layer = APP_ENV.CL_TESSELATION_LAYER;

        // Not sure how to check gl1. Will need to revisit this.
        if (layer !== 'gl0') return;

        const ordinal = await nodeUtils.getNodeLatestOrdinal();
        const clusterOrdinal = await this.getSourceNodeLatestOrdinal();
        storeUtils.setNodeStatusInfo({ clusterOrdinal, ordinal });

        logger.log(`Checking local snapshot distance from cluster: ${clusterOrdinal - ordinal}`);

        if (ordinal !== clusterOrdinal) {
            logger.log(`    Current ordinal: ${ordinal}`);
            logger.log(`    Cluster ordinal: ${clusterOrdinal}`);

            const errors = await this.hasHealableErrors();

            if (errors) {
                logger.log('Detected healable errors in logs...\n' + errors);
                await nodeUtils.leaveCluster();
                throw new Error('checkLatestOrdinals: RESTART_REQUIRED');
            }

            if (ordinal + 20 < clusterOrdinal) {
                logger.error(`Node ordinal is being left too far behind - Leaving Cluster...`);
                await nodeUtils.leaveCluster();
                throw new Error('checkLatestOrdinals: RESTART_REQUIRED');
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
            await nodeUtils.leaveCluster();
            throw new Error(`Hash mismatch detected at ordinal ${ordinalToCheck} - Node: ${nodeOrdinalHash}, Source: ${sourceNodeOrdinalHash} - Leaving Cluster...`);
        }
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
        } // 4054563

        return this.getSourceNodeInfo();
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

    async makeSourceNodeRequest(path: string) {
        return fetch(`http://${APP_ENV.CL_L0_PEER_HTTP_HOST}:${APP_ENV.CL_L0_PEER_HTTP_PORT}/${path}`)
            .then(res =>  res.json())
            .catch(() => {
                logger.warn(`Failed to fetch from source at ${APP_ENV.CL_L0_PEER_HTTP_HOST}:${APP_ENV.CL_L0_PEER_HTTP_PORT}.`);
                throw new Error('Unable to connect');
            })
    }
}