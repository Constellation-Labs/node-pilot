import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {NodeInfo, TessellationLayer} from "../types.js";
import {clusterService} from "./cluster-service.js";
import {shellService} from "./shell-service.js";
import {archiverService} from "./archiver-service.js";

export const nodeService = {

    async getNodeInfo(layer: 'first' | TessellationLayer): Promise<NodeInfo> {

        if (layer === 'first') {
            layer = configStore.getProjectInfo().layersToRun[0];
        }

        const portInfo = configStore.getLayerPortInfo(layer);

        return fetch(`http://localhost:${portInfo.PUBLIC}/node/info`)
            .then(res => {
                if (res.ok) return res.json().then(i => ({...i, layer}));
                throw new Error(`Failed`);
            })
            .catch(() => ({layer, state: "Unavailable"}));
    },

    async getSnapshotHash(ipAddr: string, ordinal: number): Promise<string> {
        return fetch(`${ipAddr}/global-snapshots/${ordinal}/hash`)
            .then(res => {
                if (res.ok) return res.json();
                clm.warn(`Failed to get snapshot hash. Status code ${res.status}`);
                return '';
            })
            .catch(() => (''));
    },

    async getStatusInfo(layer: TessellationLayer) {
      return layer;
    },

    async isPortExposed(port: number) {
        const command = configStore.getSystemInfo().platform === 'linux' ? `ss -tuln | grep 0.0.0.0:${port}` : `netstat -an | grep '*.${port}'`;
        return shellService.runCommandWithOutput(command).then(o => o.length > 0);
    },

    async isPortInUse(port: number) {
        clm.preStep('Making a sudo call to check if a port is in use...');
        return shellService.runCommandWithOutput(`sudo lsof -i :${port}`).then(Boolean).catch(() => false);
    },

    async isPortOpen(port: number) {
        const command = configStore.getSystemInfo().platform === 'linux' ? `ss -tuln | grep :${port}` : `netstat -an | grep '.${port}'`;
        return shellService.runCommandWithOutput(command).then(o => o.length > 0);
    },

    async joinCluster(layer: TessellationLayer): Promise<void> {

        const { state } = await this.getNodeInfo(layer);
        if (state !== "ReadyToJoin") {
            clm.warn(`Node is not ready to join the cluster. Current state: "${state}".`);
            return;
        }

        const layerPortInfo = configStore.getLayerPortInfo(layer);
        const peerInfo = await clusterService.getClusterNodeInfo(layer);
        const nodeId = peerInfo.id;
        const nodeIp = peerInfo.host;
        const cliPort = layerPortInfo.CLI;
        const nodeP2pPort = peerInfo.p2pPort;

        if (layer === 'gl0') {
            // await clusterService.fastForwardSnapshot();
            await archiverService.syncToLatestSnapshot()
                .catch(() => {
                    clm.warn(`Failed to download latest snapshots using Starchiver. Using fast forward to latest snapshot.`);
                    clusterService.fastForwardSnapshot();
                })
        }

        // escape only the quotes in the body
        const body = JSON.stringify({ id: nodeId, ip: nodeIp, p2pPort: nodeP2pPort }).replaceAll('"', String.raw`\"`);

        const url = `http://localhost:${cliPort}/cluster/join`;

        clm.preStep(`Joining ${layer} to cluster`); // on ${cliPort}...${body} ... ${url}`);

        await shellService.execDockerShell(layer, `curl -X POST '${url}' -H 'Content-Type: application/json' --data '${body}'` )

        await this.pollForState(layer, 'Ready');
    },

    async leaveCluster(layer: TessellationLayer): Promise<boolean> {

        const { state } = await this.getNodeInfo(layer);

        if (state === "Offline") {
            clm.echo(`Node has already left the cluster. Current state: "${state}".`);
            return true;
        }

        if (state === "ReadyToJoin") {
            clm.echo(`Node has not joined the cluster yet. Current state: "${state}".`);
            return true;
        }

        if (state === "Unavailable") {
            clm.echo(`Node is not running.`);
            return true;
        }

        const {CLI: cliPort} = configStore.getLayerPortInfo(layer);

        clm.preStep(`${layer} is leaving the cluster. Current state: "${state}"`);

        return shellService.execDockerShell(layer, `curl -X POST 'http://localhost:${cliPort}/cluster/leave'` )
            .then(() => true)
            .catch(() => false);
    },

    async leaveClusterAllLayers(): Promise<boolean> {
        const layers = configStore.getProjectInfo().layersToRun;
        const promises = layers.map(l => this.leaveCluster(l));
        const results = await Promise.all(promises);
        return results.every(Boolean);
    },

    async pollForLayersState(layers: TessellationLayer[], state = 'ReadyToJoin'): Promise<boolean> {
        for (const layer of layers) {
            // eslint-disable-next-line no-await-in-loop
            const readyToJoin = await this.pollForState(layer, state);
            if (!readyToJoin) {
                return false;
            }
        }

        return true;
    },

    async pollForState(layer: TessellationLayer, expectedState = 'ReadyToJoin'): Promise<boolean> {
        clm.preStep(`Waiting for ${layer.toUpperCase()} Validator Node to become ${expectedState}...`);

        await sleep(1);

        for (let i = 1; i <= 60; i++) {
            // eslint-disable-next-line no-await-in-loop
            const { state } = await this.getNodeInfo(layer);

            if (expectedState === 'Offline' && (state === "Unavailable" || state === "ReadyToJoin" || state === "SessionStarted")) return true;

            clm.echoRepeatLine(`[${layer}] ${chalk.bgGray.cyan('Attempt ' +i)}: Current state is "${state}"                       `);
            // eslint-disable-next-line no-await-in-loop
            await sleep(0.5);
            clm.echoRepeatLine(`[${layer}] Attempt ${i}: Current state is "${state}"                       `);

            if (state === expectedState) {
                clm.postStep(`${layer} is ${expectedState}`);
                return true;
            }

            if (state === "Unavailable" && i > 2) {
                clm.warn(`${layer} is not connectable. Please try again later.`);
                return false;
            }

            // eslint-disable-next-line no-await-in-loop
            await sleep(5);
        }

        clm.warn(`${layer} is not ${expectedState} after 5 minutes`);
        return false;
    }
};

function sleep(sec: number) {
    return new Promise(resolve => {setTimeout(resolve, sec * 1000)});
}