import {input} from "@inquirer/prompts";
import ora from "ora";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {ClusterConsensusInfo, ClusterInfo, NodeInfo, NodeParamsDto, TessellationLayer} from "../types.js";
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

    async getClusterInfo(layer?: TessellationLayer) {
        return this.makeClusterRequestGet<ClusterInfo[]>('cluster/info', layer)
            .then(cInfo => {
                if (!isClusterReady(cInfo)) {
                    return this.makeClusterRequestGet<ClusterInfo[]>('cluster/info', layer, '?sticky=false')
                        .then(cInfo => {
                            if (!isClusterReady(cInfo)) {
                                if (cInfo.length > 0) {
                                    clm.warn(`Found ${cInfo.length} nodes in the cluster, but none are READY.`);
                                }

                                throw new Error(`Network is not connectable.`);
                            }

                            return cInfo;
                        })
                }

                return cInfo;
            })
    },

    async getClusterNodeInfo(layer?: TessellationLayer) {
        return this.makeClusterRequestGet<NodeInfo>('node/info', layer);
    },

    async getLatestConsensusInfo(layer?: TessellationLayer){
         return this.makeClusterRequestGet<ClusterConsensusInfo>('consensus/latest/peers', layer);
    },

    getLayer0() {
        return configStore.getProjectInfo().layersToRun.includes('gl0') ? 'gl0': 'ml0';
    },

    async getNodeParams(id: string) {
        return this.makeClusterRequestGet<NodeParamsDto>(`node-params/${id}`, 'gl0');
    },

    async getReleaseVersion() {
        clm.debug('Getting release version...');
        return this.makeRandomSourceNodeRequest<NodeInfo>('node/info').then(i => i.version)
            .catch(() => {
                clm.debug(`Failed to get random source node. Attempting cluster node...`);
                return this.makeClusterRequestGet<NodeInfo>('node/info').then(i => i.version)
            });
    },

    async getSourceNodeInfo(layer: TessellationLayer) {
        return this.makeRandomSourceNodeRequest<NodeInfo>('node/info', layer);
    },

    async getSourceNodeLatestOrdinal(layer: TessellationLayer): Promise<number> {
        return this.makeRandomSourceNodeRequest<{ value: { ordinal: number }}>('global-snapshots/latest', layer).then(i => i.value.ordinal);
    },

    async getSourceNodeOrdinalHash(layer: TessellationLayer, ordinal: number) {
        return this.makeRandomSourceNodeRequest<string>(`global-snapshots/${ordinal}/hash`, layer);
    },

    async makeClusterRequestGet<T>(path: string, layer?: TessellationLayer, params = ''): Promise<T> {

        layer = layer || this.getLayer0();
        const {type} = configStore.getNetworkInfo();
        const envLayerInfo = configStore.getEnvLayerInfo(type, layer);


        if (envLayerInfo.CL_LB) {
            const url = `${envLayerInfo.CL_LB}/${path}${params}`;
            clm.debug(`makeClusterRequestGet ${url}`);
            return fetch(url)
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
                    if (!params) {
                        return this.makeClusterRequestGet(path, layer, '?sticky=false');
                    }

                    // clm.debug(`Failed to get cluster GET from ${envLayerInfo.CL_LB}/${path}. Attempting source node...`);
                    // return this.makeRandomSourceNodeRequest(path, layer);
                    throw new Error(`Unable to connect to cluster at ${envLayerInfo.CL_LB}/${path}`)
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

    async makeRandomSourceNodeRequest<T>(path: string, layer?: TessellationLayer) {
        return this.makeClusterRequestGet<T>(path, layer, '?source_node=true&sticky=false');
    },

    async makeSourceNodeRequest(path: string, layer: TessellationLayer) {
        const {type} = configStore.getNetworkInfo();

        const {CL_SOURCE_HTTP_PORT} = configStore.getEnvLayerInfo(type, layer);
        const {CL_L0_PEER_HTTP_HOST} = configStore.getEnvNetworkInfo(type);

        clm.debug(`http://${CL_L0_PEER_HTTP_HOST}:${CL_SOURCE_HTTP_PORT}/${path}`);

        return fetch(`http://${CL_L0_PEER_HTTP_HOST}:${CL_SOURCE_HTTP_PORT}/${path}`)
            .then(res =>  res.json())
            .catch(() => {
                throw new Error(`Unable to connect to source node at http://${CL_L0_PEER_HTTP_HOST}:${CL_SOURCE_HTTP_PORT}/${path}`)
            })
    },

    async postNodeParams(body: string, layer?: TessellationLayer): Promise<string> {
        return this.makeClusterRequestPost(`node-params`, body, layer);
    }
};

function isClusterReady(info: ClusterInfo[]) {
    return info.some(node => node.state === 'Ready');
}