import {input} from "@inquirer/prompts";
import ora from "ora";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {ClusterConsensusInfo, ClusterInfo, NodeInfo, TessellationLayer} from "../types.js";
import {FastforwardService} from "./fastforward-service.js";

export const clusterService = {

    async fastForwardSnapshot(): Promise<void> {

        // const { fastForward } = configStore.getProjectInfo();
        //
        // if (fastForward === false) {
        //     return;
        // }

        if (!configStore.getProjectInfo().layersToRun.includes('gl0')) {
            return;
        }

        // if(fastForward === undefined) {
            const answer = await input({
                default: 'y', message: 'Do you want to use the snapshot fast forward feature? (y/n): '
            })
            if (answer !== 'y') {
                configStore.setProjectInfo({fastForward: false})
                return;
            }

            configStore.setProjectInfo({fastForward: true})
        // }

        const spinner = ora('Downloading latest snapshot...');
        spinner.start();
        spinner.color = 'green';

        await FastforwardService.synctoLatestSnapshot();

        spinner.stop();
    },

    async getClusterInfo(layer?: TessellationLayer): Promise<ClusterInfo[]> {
        return this.makeClusterRequestGet('cluster/info', layer);
    },

    async getClusterNodeInfo(layer?: TessellationLayer): Promise<NodeInfo> {
        return this.makeClusterRequestGet('node/info', layer);
    },

    async getLatestConsensusInfo(layer?: TessellationLayer): Promise<ClusterConsensusInfo> {
         return this.makeClusterRequestGet('consensus/latest/peers', layer);
    },

    getLayer0() {
        return configStore.getProjectInfo().layersToRun.includes('gl0') ? 'gl0': 'ml0';
    },

    async getNodeParams(id: string) {
        return this.makeClusterRequestGet(`node-params/${id}`, 'gl0');
    },

    async getReleaseVersion() {
        return this.getClusterNodeInfo().then(i => i.version);
    },

    async getSourceNodeInfo(layer: TessellationLayer): Promise<NodeInfo> {
        return this.makeSourceNodeRequest('node/info', layer);
    },

    async getSourceNodeLatestOrdinal(layer: TessellationLayer): Promise<number> {
        return this.makeSourceNodeRequest('global-snapshots/latest', layer).then(i => i.value.ordinal);
    },

    async getSourceNodeOrdinalHash(layer: TessellationLayer, ordinal: number): Promise<string> {
        return this.makeSourceNodeRequest(`global-snapshots/${ordinal}/hash`, layer);
    },

    async makeClusterRequestGet(path: string, layer?: TessellationLayer) {

        layer = layer || this.getLayer0();
        const {type} = configStore.getNetworkInfo();
        const envLayerInfo = configStore.getEnvLayerInfo(type, layer);

        if (envLayerInfo.CL_LB) {
            return fetch(`${envLayerInfo.CL_LB}/${path}`)
                .then(res => {
                    if (res.ok) {
                        return res.json()
                    }

                    if (res.status === 404) {
                        return null;
                    }

                    clm.debug(`Error ${res.status}. statusText: ${res.statusText}`);
                    throw new Error('Error');

                })
                .catch(() => {
                    clm.debug(`Failed to get node info from ${envLayerInfo.CL_LB}/${path}. Attempting source node...`);
                    return this.makeSourceNodeRequest(path, layer);
                });
        }

        return this.makeSourceNodeRequest(path, layer);
    },

    async makeClusterRequestPost(path: string, body: string, layer?: TessellationLayer) {

        layer = layer || this.getLayer0();
        const {type} = configStore.getNetworkInfo();
        const envLayerInfo = configStore.getEnvLayerInfo(type, layer);

        return fetch(`${envLayerInfo.CL_LB}/${path}`, {
            body,
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
        })
        .then(res => res.json())
    },

    async makeSourceNodeRequest(path: string, layer: TessellationLayer) {
        const {type} = configStore.getNetworkInfo();

        const {CL_PUBLIC_HTTP_PORT} = configStore.getEnvLayerInfo(type, layer);
        const {CL_L0_PEER_HTTP_HOST} = configStore.getEnvNetworkInfo(type);

        clm.debug(`http://${CL_L0_PEER_HTTP_HOST}:${CL_PUBLIC_HTTP_PORT}/${path}`);

        return fetch(`http://${CL_L0_PEER_HTTP_HOST}:${CL_PUBLIC_HTTP_PORT}/${path}`)
            .then(res =>  res.json())
            .catch(() => {
                throw new Error(`Unable to connect to source node at http://${CL_L0_PEER_HTTP_HOST}:${CL_PUBLIC_HTTP_PORT}/${path}`)
            })
    },

    async postNodeParams(body: string, layer?: TessellationLayer): Promise<string> {
        return this.makeClusterRequestPost(`node-params`, body, layer);
    }
};

