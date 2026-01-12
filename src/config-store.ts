
import {JSONStorage} from "node-localstorage";
import fs from "node:fs";

import packageJson from '../package.json' with {type: 'json'};
import {ClusterStats, TessellationLayer} from "./types.js";

const pilotReleaseInfo = { name: packageJson.name, version: packageJson.version };

export class EmptyStorage extends JSONStorage {
    constructor() {super("/tmp");}

    getItem(_key: string) { return null; }

    setItem(_key: string, _value: never) { }
}

class ConfigStore {

    private projectStore: JSONStorage = new EmptyStorage();

    getDockerEnvInfo(): object {
        return this.projectStore.getItem('docker');
    }

    getEnvInfo(): EnvInfo {
        return this.projectStore.getItem('env') || {};
    }

    getEnvLayerInfo(network: NetworkType, layer: TessellationLayer): EnvLayerInfo {
        const envInfo = this.projectStore.getItem('layer-env') as Record<NetworkType, Record<TessellationLayer, EnvLayerInfo>>;
        if (!envInfo) return  { [network]: {}} as EnvLayerInfo;
        return envInfo[network][layer] || {} as EnvLayerInfo;
    }

    getEnvNetworkInfo(network: NetworkType): EnvNetworkInfo {
        const envInfo = this.projectStore.getItem('network-env') as Record<NetworkType, EnvNetworkInfo>;
        if (!envInfo) return  {} as EnvNetworkInfo;
        return envInfo[network];
    }

    getLayerPortInfo(layer: TessellationLayer): PortInfo {
        const { type: network } = this.getNetworkInfo();
        const layerInfo = this.getEnvLayerInfo(network, layer);
        return { CLI: layerInfo.CL_CLI_HTTP_PORT, P2P: layerInfo.CL_P2P_HTTP_PORT, PUBLIC: layerInfo.CL_PUBLIC_HTTP_PORT }
    }

    getNetworkInfo(): NetworkInfo {
        return this.projectStore.getItem('network') || {};
    }

    getPilotReleaseInfo() {
        return pilotReleaseInfo;
    }

    getProjectInfo(): ProjectInfo {
        return this.projectStore.getItem('project') || {};
    }

    hasProjectFlag(name: string) {
        const flags =  this.projectStore.getItem('flags') || {};
        return flags[name] || false;
    }

    setClusterStats(info: Partial<ClusterStats>) {
        const oldInfo = this.projectStore.getItem('cluster-stats');
        this.projectStore.setItem('cluster-stats', { ...oldInfo, ...info });
    }

    setDockerEnvInfo(info: Partial<DockerEnvInfo>) {
        const oldInfo = this.projectStore.getItem('docker');
        this.projectStore.setItem('docker', { ...oldInfo, ...info });
    }

    setEnvInfo(info: Partial<EnvInfo>) {
        const oldInfo = this.projectStore.getItem('env');
        this.projectStore.setItem('env', { ...oldInfo, ...info });
    }

    setEnvLayerInfo(network: NetworkType, layer: TessellationLayer, info: Partial<EnvLayerInfo>) {
        let layers = this.projectStore.getItem('layer-env') as Record<NetworkType, Record<TessellationLayer, EnvLayerInfo>>;
        if (!layers) layers = {} as Record<NetworkType, Record<TessellationLayer, EnvLayerInfo>>;
        if (!layers[network]) layers[network] = {} as Record<TessellationLayer, EnvLayerInfo>;
        this.projectStore.setItem('layer-env', { ...layers, [network]: { ...layers[network], [layer]: { ...layers[network][layer], ...info } } });
    }

    setEnvNetworkInfo(network: NetworkType, info: Partial<EnvNetworkInfo>) {
        let networks = this.projectStore.getItem('network-env');
        if (!networks) networks = {};
        this.projectStore.setItem('network-env', { ...networks, [network]: { ...networks[network], ...info } } );
    }

    setNetworkInfo(info: Partial<NetworkInfo>) {
        const oldInfo = this.projectStore.getItem('network');
        this.projectStore.setItem('network', { ...oldInfo, ...info });
    }


    setProjectConfig(config: string) {
        const projectExists = fs.existsSync(config);
        this.projectStore = projectExists ? new JSONStorage(config) : new EmptyStorage();
    }

    setProjectFlag(name: string, value: boolean){
        const flags =  this.projectStore.getItem('flags') || {};
        flags[name] = value;
        this.projectStore.setItem('flags', flags);
        return flags;
    }

    setProjectInfo(info: Partial<ProjectInfo>) {
        const oldInfo = this.projectStore.getItem('project');
        this.projectStore.setItem('project', { ...oldInfo, ...info });
    }


}

export const configStore = new ConfigStore();

// type DeepPartial<T> = {
//     [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
// };



export type DockerEnvInfo = {
    CL_GL0_P2P_PORT: string;
    CL_GL0_PUBLIC_PORT: string;
    CL_GL1_P2P_PORT: string;
    CL_GL1_PUBLIC_PORT: string;
    DOCKER_IMAGE_VERSION: string;
}

export type EnvInfo = EnvKeyInfo & {
    CL_ARCHIVE_NODE: boolean;
    CL_EXTERNAL_IP: string;
}

export const envNames = {
    CL_EXTERNAL_IP: 1,
    CL_KEYALIAS: 1,
    CL_KEYSTORE: 1,
    CL_PASSWORD: 1
}

export type EnvCombinedInfo = EnvInfo & EnvLayerInfo & EnvNetworkInfo;

export type EnvNetworkInfo = EnvPeerInfo & {
    CL_APP_ENV: string;
    CL_COLLATERAL: string;
    CL_L0_TOKEN_IDENTIFIER: string; // metagraph
}

export type EnvKeyInfo  = {
    CL_KEYALIAS: string;
    CL_KEYSTORE: string;
    CL_PASSWORD: string;
}

export type EnvPeerInfo = {
    CL_GLOBAL_L0_PEER_HOST: string;
    CL_GLOBAL_L0_PEER_HTTP_PORT: string;
    CL_GLOBAL_L0_PEER_ID: string;
    CL_L0_PEER_HTTP_HOST: string;
    CL_L0_PEER_HTTP_PORT: string;
    CL_L0_PEER_ID: string;
    CL_L0_PEER_P2P_PORT: string;
}

export const networkEnvNames = {
    CL_APP_ENV: 1,
    CL_GLOBAL_L0_PEER_HOST: 1,
    CL_GLOBAL_L0_PEER_HTTP_PORT: 1,
    CL_GLOBAL_L0_PEER_ID: 1,
    CL_L0_PEER_HTTP_HOST: 1,
    CL_L0_PEER_HTTP_PORT: 1,
    CL_L0_PEER_ID: 1,
    CL_L0_PEER_P2P_PORT: 1,
    CL_L0_TOKEN_IDENTIFIER: 1
}

export type EnvLayerInfo = EnvPeerInfo & {
    CL_CLI_HTTP_PORT: string;
    CL_DOCKER_JAVA_OPTS: string;
    CL_LB: string;
    CL_P2P_HTTP_PORT: string;
    CL_PUBLIC_HTTP_PORT: string;
    CL_SOURCE_HTTP_PORT: string;
}

// NETWORK LAYER
export const layerEnvNames = {
    CL_CLI_HTTP_PORT: 1,
    CL_DOCKER_JAVA_OPTS: 1,
    CL_GLOBAL_L0_PEER_HOST: 1,
    CL_GLOBAL_L0_PEER_HTTP_PORT: 1,
    CL_GLOBAL_L0_PEER_ID: 1,
    CL_L0_PEER_HTTP_HOST: 1,
    CL_L0_PEER_HTTP_PORT: 1,
    CL_L0_PEER_ID: 1,
    CL_L0_PEER_P2P_PORT: 1,
    CL_LB: 1,
    CL_P2P_HTTP_PORT: 1,
    CL_PUBLIC_HTTP_PORT: 1,
    CL_SOURCE_HTTP_PORT: 1
}

// export const keyInfoNames = {
//     KEY_ALIAS: 1,
//     KEY_FILE: 1,
//     NODE_ADDRESS: 1,
//     NODE_ID: 1,
// }

export type SystemInfo = {
    cores: number;
    disk: string;
    isDockerInstalled: boolean;
    memory: string;
    platform: string;
    user: string;
}

export type NetworkType = 'integrationnet' | 'mainnet' | 'testnet';

export type ProjectInfo = {
    dagAddress: string;
    fastForward: boolean;
    homeDir: string;
    layersToRun: TessellationLayer[];
    name: string;
    nodeId: string;
    projectDir: string;
    type: 'hypergraph' | 'metagraph';
    version: string;
}

export type NetworkInfo = {
    supportedTypes: NetworkType[];
    type: NetworkType;
    version: string;
}

export type PortInfo = {
    CLI: string;
    P2P: string;
    PUBLIC: string;
}

