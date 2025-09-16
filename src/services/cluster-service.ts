import {input} from "@inquirer/prompts";

import {configStore} from "../config-store.js";
import {ClusterConsensusInfo, ClusterInfo, NodeInfo, TessellationLayer} from "../types.js";
import {FastforwardService} from "./fastforward-service.js";

export const clusterService = {

    async fastForwardSnapshot(): Promise<void> {

        const { fastForward } = configStore.getProjectInfo();

        if (fastForward === false) {
            return;
        }

        if (!configStore.getProjectInfo().layersToRun.includes('gl0')) {
            return;
        }

        if(fastForward === undefined) {
            const answer = await input({
                default: 'y', message: 'Do you want to use the snapshot fast forward feature? (y/n): '
            })
            if (answer !== 'y') {
                configStore.setProjectInfo({fastForward: false})
                return;
            }

            configStore.setProjectInfo({fastForward: true})
        }

        await FastforwardService.synctoLatestSnapshot();
    },

    async getClusterInfo(): Promise<ClusterInfo[]> {
        const { type } = configStore.getNetworkInfo();

        return fetch(`https://l0-lb-${type}.constellationnetwork.io/cluster/info`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error(`Failed`);
            })
            .catch(() => []);
    },

    async getJoinPeer(layer: TessellationLayer): Promise<NodeInfo> {
        // const {type} = configStore.getNetworkInfo();
        // const envLayerInfo = configStore.getEnvLayerInfo(type, layer);
        // if (envLayerInfo.CL_LB) {
        //     return fetch(`${envLayerInfo.CL_LB}/node/info`).then(res => res.json());
        // }

        return this.getSourceNodeInfo(layer);
    },

    async getLatestConsensus(): Promise<ClusterConsensusInfo> {
        const { type } = configStore.getNetworkInfo();

        return fetch(`https://l0-lb-${type}.constellationnetwork.io/consensus/latest/peers`)
            .then(res => {
                if (res.ok) return res.json();
                return 0;
            })
            .catch(() => 0);
    },

    async getLatestOrdinal() {
        const { type } = configStore.getNetworkInfo();

        return fetch(`https://l0-lb-${type}.constellationnetwork.io/global-snapshots/latest`)
            .then(res => {
                if (res.ok) return res.json().then(i => (i?.value?.ordinal || 0));
                return 0;
            })
            .catch(() => 0);
    },

    async getNodeInfo(): Promise<NodeInfo> {
        const { type } = configStore.getNetworkInfo();

        return fetch(`https://l0-lb-${type}.constellationnetwork.io/node/info`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error(`Failed`);
            })
            .catch(() => ({state: "Unavailable"}));
    },

    async getReleaseVersion() {
        return this.getNodeInfo().then(i => i.version);
    },

    async getSourceNodeInfo(layer: TessellationLayer): Promise<NodeInfo> {
        const {type} = configStore.getNetworkInfo();

        // eslint-disable-next-line no-warning-comments
        // TODO: provide a source-node.env with necessary properties

        const {CL_PUBLIC_HTTP_PORT} = configStore.getEnvLayerInfo(type, layer);
        const {CL_L0_PEER_HTTP_HOST} = configStore.getEnvNetworkInfo(type);

        return fetch(`http://${CL_L0_PEER_HTTP_HOST}:${CL_PUBLIC_HTTP_PORT}/node/info`)
            .then(res =>  res.json())

    }
};

