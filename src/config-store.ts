import {input} from "@inquirer/prompts";
import {JSONStorage} from "node-localstorage";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {clm} from "./clm.js";
import {ClusterStats, TessellationLayer} from "./types.js";

class EmptyStorage extends JSONStorage {
    constructor() {super("/tmp");}

    getItem(_key: string) { return null; }

    setItem(_key: string, _value: never) { }
}

class ConfigStore {

    private pilotStore: JSONStorage;
    private projectStore: JSONStorage;

    constructor() {
        const appDir = path.join(os.homedir(), '.node-pilot');

        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir, {recursive: true});
        }

        this.pilotStore = new JSONStorage(path.join(appDir,'config'));

        const appInfo = this.pilotStore.getItem('pilot') as PilotInfo;
        if (!appInfo) {
            this.pilotStore.setItem('pilot', { appDir, project: 'undefined', projects: [] });
        }

        const { project } = this.pilotStore.getItem('pilot') as PilotInfo;
        this.projectStore = project === 'undefined' ? new EmptyStorage() : new JSONStorage(path.join(appDir, project, 'config'));
    }

    async applyNewProjectStore(name: string) {

        const { appDir, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;
        const projectDir = path.join(appDir, name);

        if (projects.includes(name)) {

            const answer = await input({default: 'n', message: `Project ${name} already exists. Do you want to reinstall? (y/n):`});
            if (answer === 'y') {
                this.projectStore = new JSONStorage(path.join(projectDir,'config'));
                this.projectStore.clear();
                fs.rmSync(projectDir, { force: true, recursive: true });
                this.pilotStore.setItem('pilot', { appDir, project: name, projects });
            }
            else {
                clm.error(`Project ${name} already exists.`);
            }
        }
        else {
            this.setPilotInfo({ project: name, projects: [...projects, name] });
        }

        fs.mkdirSync(path.join(projectDir,'config'), {recursive: true});

        this.projectStore = new JSONStorage(path.join(projectDir,'config'));

        this.setDockerEnvInfo({ DOCKER_IMAGE_VERSION: 'test' });
        this.setProjectInfo({ name, projectDir })
    }

    changeProjectStore(name: string) {
        const { appDir, project, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;

        if (projects && projects.includes(name)) {
            if (project === name) return;
            this.projectStore = new JSONStorage(path.join(appDir, name, 'config'));
            this.setPilotInfo({ project: name });
        }
        else {
            throw new Error(`Project ${name} doesn't exist.`);
        }
    }

    getAppDir(): string {
        const { appDir }  = this.pilotStore.getItem('pilot') as PilotInfo;
        return appDir;
    }

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
        return this.projectStore.getItem('network');
    }

    getProjectInfo(): ProjectInfo {
        return this.projectStore.getItem('project');
    }

    getProjects() {
        const { projects } = this.pilotStore.getItem('pilot') as PilotInfo;
        return projects;
    }

    getSystemInfo(): SystemInfo {
        return this.pilotStore.getItem('system');
    }

    hasProjectFlag(name: string){
        const flags =  this.projectStore.getItem('flags') || {};
        return flags[name] || false;
    }

    hasProjects() {
        const { projects } = this.pilotStore.getItem('pilot') as PilotInfo;
        return projects.length > 0;
    }

    // setCurrentEnvNetworkInfo(info: Partial<EnvNetworkInfo>) {
    //     const {type} = this.getNetworkInfo();
    //     this.setEnvNetworkInfo(type, info);
    // }

    setClusterStats(info: Partial<ClusterStats>) {
        const oldInfo = this.projectStore.getItem('cluster-stats');
        this.projectStore.setItem('cluster-stats', { ...oldInfo, ...info });
    }

    setDockerEnvInfo(info: Partial<{ DOCKER_IMAGE_VERSION: string, DOCKER_USER_ID: string}>) {
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

    setSystemInfo(info: Partial<SystemInfo>) {
        const oldInfo = this.projectStore.getItem('system');
        this.pilotStore.setItem('system', { ...oldInfo, ...info });
    }

    private getPilotInfo(): PilotInfo {
        return this.pilotStore.getItem('pilot') as PilotInfo;
    }

    private setPilotInfo(info: Partial<PilotInfo>) {
        const oldInfo = this.pilotStore.getItem('pilot') as PilotInfo;
        this.pilotStore.setItem('pilot', { ...oldInfo, ...info });
    }
}

export const configStore = new ConfigStore();

// type DeepPartial<T> = {
//     [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
// };

type PilotInfo = {
    appDir: string;
    project: string;
    projects: string[];
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
    CL_L0_TOKEN_IDENTIFIER: 1,
}

export type EnvLayerInfo = EnvPeerInfo & {
    CL_CLI_HTTP_PORT: string;
    CL_DOCKER_JAVA_OPTS: string;
    CL_LB: string;
    CL_P2P_HTTP_PORT: string;
    CL_PUBLIC_HTTP_PORT: string;
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
    CL_PUBLIC_HTTP_PORT: 1
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

