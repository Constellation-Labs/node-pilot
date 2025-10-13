import fs from "node:fs";
import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {NodeInfo, NodeState} from "../types.js";
import {archiveUtils} from "./archive-utils.js";
import {clusterUtils} from "./cluster-utils.js";
import {storeUtils} from "./store-utils.js";

const ValidStatesAfterReady = new Set([
    NodeState.DownloadInProgress,
    NodeState.Leaving,
    NodeState.Observing,
    NodeState.Ready
]);

const OutOfClusterStates = new Set([
    NodeState.Offline,
    NodeState.ReadyToJoin,
    NodeState.SessionStarted,
    NodeState.SessionStarting,
    NodeState.Unavailable
]);

export const nodeUtils = {

    async checkUnrecoverableStates(serviceName: string, state: NodeState) {
        logger.log('Checking unrecoverable states');
        const {hasJoined = false} = storeUtils.getNodeStatusInfo();
        if (hasJoined && !ValidStatesAfterReady.has(state)) {
            logger.error(`${serviceName} is unhealthy. State: ${state}`);
            storeUtils.setNodeStatusInfo({error: 'unrecoverable state'});
            throw new Error('RESTART_REQUIRED');
        }
    },

    async getCurrentState(): Promise<NodeState> {

        const {clusterSession, session, state} = await this.getNodeInfo();

        storeUtils.setNodeStatusInfo({session, state});
        storeUtils.setLastState(state);

        let clusterState = 'Ready';
        if (state !== NodeState.Ready) {
            // Check for cluster health
            const peerInfo = await clusterUtils.getClusterConsensusPeers();

            if (peerInfo.peerCount >= 0) {
                if (peerInfo.peerCount === 0) {
                    logger.warn(`Cluster is unhealthy. Peer count: ${peerInfo.peerCount}`);
                    clusterState = 'Offline'
                } else if (peerInfo.peerCount < 4) {
                    logger.warn(`Cluster is unhealthy. Peer count: ${peerInfo.peerCount}`);
                    clusterState = 'Restarting'
                } else if (peerInfo.includesSourceNode) {
                    clusterState = 'Ready';
                }
                else {
                    clusterState = 'WaitingForSourceNode'
                }
            }
        }

        storeUtils.setNodeStatusInfo({clusterState});

        let {hasJoined = false} = storeUtils.getNodeStatusInfo();

        if (hasJoined && OutOfClusterStates.has(state)) {
            logger.log(`Node left the cluster. Current state: ${state}`);
            storeUtils.setNodeStatusInfo({hasJoined: false});
            hasJoined = false;
        }

        if (!hasJoined) {
            const {isHydrateRunning} = storeUtils.getTimerInfo();
            const {pilotSession='0'} = storeUtils.getNodeStatusInfo();
            if (state === 'Ready') {
                logger.log(`Node has joined the cluster. Current state: ${state}.`);
                storeUtils.setNodeStatusInfo({clusterSession, error: '', hasJoined: true, pilotSession: APP_ENV.NODE_PILOT_SESSION});
                const { fatal: hadFatal = false } = storeUtils.getTimerInfo();
                if (hadFatal) {
                    logger.fatal(`Node has recovered`);
                    storeUtils.setTimerInfo({fatal: false});
                }
                else {
                    logger.log(`Node has started a new session.`);
                }
            }
            else if (state === 'ReadyToJoin') {
                logger.log(`Node is ready to join the cluster. Current state: ${state}. Last session: ${pilotSession}. Node Pilot session: ${APP_ENV.NODE_PILOT_SESSION}`);
                if (pilotSession === APP_ENV.NODE_PILOT_SESSION) {
                    const {isRunning} = storeUtils.getArchiveInfo();
                    if (isRunning) {
                        logger.log(`Hydrate is running.`);
                    }
                    else if (isHydrateRunning || APP_ENV.CL_TESSELATION_LAYER !== 'gl0') {
                        storeUtils.setTimerInfo({isHydrateRunning: false});

                        logger.log(`Initiating auto join...`);
                        storeUtils.setNodeStatusInfo({error: '', state: 'JoiningCluster'});
                        const nodeInfo = await clusterUtils.getClusterNodeInfo();
                        await nodeUtils.joinCluster(nodeInfo);
                    }
                    else {
                        storeUtils.setTimerInfo({isHydrateRunning: true});
                        storeUtils.setNodeStatusInfo({state: 'HydratingSnapshots'});
                        await archiveUtils.runHydrate();
                    }

                }
            }
        }

        // logger.log('Current state: ' + state);
        return state;
    },

    async getNodeInfo(): Promise<NodeInfo> {
        return this.makeNodeRequest('node/info');
    },

    async getNodeLatestOrdinal(): Promise<number> {
        return this.makeNodeRequest(`${APP_ENV.SNAPSHOT_URL_PATH}/latest`)
            .then(info => {
                if (info.message && info.message === "Node is not ready yet") {
                    throw new Error('Node is no longer at latest');
                }

                return info.value.ordinal;
            });
    },

    getNodeLatestOrdinalOnDisk() {

        const dataDir = path.join(APP_ENV.PATH_DATA, 'incremental_snapshot', 'ordinal');

        const chunk = fs.readdirSync(dataDir).sort().pop() as string;

        const ordinal = fs.readdirSync(path.join(dataDir, chunk)).sort().pop() as string;

        return Number(ordinal);
    },

    async getNodeOrdinalHash(ordinal: number): Promise<string> {
        return this.makeNodeRequest(`${APP_ENV.SNAPSHOT_URL_PATH}/${ordinal}/hash`);
    },

    async joinCluster(node: NodeInfo) {
        const body = JSON.stringify({"id":node.id,"ip":node.host,"p2pPort":node.p2pPort});
        const url = `http://localhost:${APP_ENV.CL_CLI_HTTP_PORT}/cluster/join`;

        console.log(`Joining ...${body}, ${url}`);

        return fetch(url, { body, headers: { "Content-Type": "application/json" }, method: "POST"})
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                return true;
            })
            .catch((error)=> {
                console.error(`Error joining to cluster:`, error);
                return false;
            })
    },

    async leaveCluster() {

        storeUtils.setNodeStatusInfo({pilotSession: APP_ENV.NODE_PILOT_SESSION});

        const state = await this.getCurrentState();

        if (state === NodeState.Offline || state === NodeState.Leaving ) {
            logger.log(`Node has already left the cluster. Current state: "${state}".`);
            return;
        }

        if (state === NodeState.ReadyToJoin) {
            logger.log(`Node has not joined the cluster yet. Current state: "${state}".`);
            return;
        }

        if (state === NodeState.Unavailable) {
            logger.log(`Node is not running.`);
            return;
        }

        const {error} = storeUtils.getNodeStatusInfo();
        if (!error) {
            storeUtils.setNodeStatusInfo({error: 'cluster-leave invoked'});
        }

        const cliPort = APP_ENV.CL_CLI_HTTP_PORT;

        logger.log(`${APP_ENV.CL_TESSELATION_LAYER} is leaving the cluster.`);

        await fetch(`http://localhost:${cliPort}/cluster/leave`, { method: 'POST' } )
    },

    async makeNodeRequest(path: string) {
        logger.debug(`Fetching node info from http://localhost:${APP_ENV.CL_PUBLIC_HTTP_PORT}/${path}`);
        return fetch(`http://localhost:${APP_ENV.CL_PUBLIC_HTTP_PORT}/${path}`)
            .then(d => d.json())
            .then(d => {
                storeUtils.setNodeStatusInfo({unavailableCount: 0});
                return d;
            })
            .catch(error => {
                logger.error(`Local node is unresponsive - ${error}`);

                let {unavailableCount=0} = storeUtils.getNodeStatusInfo();

                unavailableCount++;

                if (unavailableCount > 4) {
                    throw new Error('RESTART_REQUIRED');
                }

                storeUtils.setNodeStatusInfo({unavailableCount});

                throw new Error(`Local node is unresponsive (${unavailableCount}): ${error}`);
            });
    },
}