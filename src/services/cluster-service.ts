import {input} from "@inquirer/prompts";

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

        await FastforwardService.synctoLatestSnapshot();
    },

    async getClusterInfo(layer?: TessellationLayer): Promise<ClusterInfo[]> {
        return this.makeClusterRequest('cluster/info', layer);
    },

    async getClusterNodeInfo(layer?: TessellationLayer): Promise<NodeInfo> {
        return this.makeClusterRequest('node/info', layer);
    },

    async getLatestConsensusInfo(layer?: TessellationLayer): Promise<ClusterConsensusInfo> {
         return this.makeClusterRequest('consensus/latest/peers', layer);
    },

    getLayer0() {
        return configStore.getProjectInfo().layersToRun.includes('gl0') ? 'gl0': 'ml0';
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

    async makeClusterRequest(path: string, layer?: TessellationLayer) {

        layer = layer || this.getLayer0();
        const {type} = configStore.getNetworkInfo();
        const envLayerInfo = configStore.getEnvLayerInfo(type, layer);

        if (envLayerInfo.CL_LB) {
            return fetch(`${envLayerInfo.CL_LB}/${path}`)
                .then(res => res.json())
                .catch(() => {
                    clm.debug(`Failed to get node info from ${envLayerInfo.CL_LB}. Attempting source node...`);
                    return this.makeSourceNodeRequest(path, layer);
                });
        }

        return this.makeSourceNodeRequest(path, layer);
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
    }
};

