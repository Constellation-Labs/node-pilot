import {input} from "@inquirer/prompts";
import {JSONStorage} from "node-localstorage";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {clm} from "./clm.js";
import {TessellationLayer} from "./types.js";

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
            this.pilotStore.setItem('pilot', { appDir, project: name, projects: [...projects, name] });
        }

        fs.mkdirSync(path.join(projectDir,'config'), {recursive: true});

        this.projectStore = new JSONStorage(path.join(projectDir,'config'));

        this.setDockerEnvInfo({ DOCKER_IMAGE_VERSION: 'test' });
        this.setProjectInfo({ name, projectDir })
        this.setEnvInfo({ common: { CL_GLOBAL_L0_PEER_HTTP_PORT: '9000' }, layers: { gl0: { CL_PUBLIC_HTTP_PORT: "9000" }}});
    }

    changeProjectStore(name: string) {
        const { appDir, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;

        if (projects && projects.includes(name)) {
            this.projectStore = new JSONStorage(path.join(appDir, name, 'config'))
        }
        else {
            throw new Error(`Project ${name} doesn't exist.`);
        }
    }

    getDockerEnvInfo(): object {
        return this.projectStore.getItem('docker');
    }

    getEnvCommonInfo(): EnvCommonInfo {
        return this.projectStore.getItem('env')?.common;
    }

    getEnvInfo(): EnvInfo {
        return this.projectStore.getItem('env');
    }

    getEnvLayerInfo(layer: TessellationLayer): EnvLayerInfo {
        const envInfo = this.projectStore.getItem('env');
        if (!envInfo) return  {} as EnvLayerInfo;
        return { ...envInfo.common, ...envInfo.layers[layer] };
    }

    getLayerPortInfo(layer: TessellationLayer): PortInfo {
        const layerInfo = this.getEnvLayerInfo(layer);
        return { CLI: layerInfo.CL_CLI_HTTP_PORT, P2P: layerInfo.CL_P2P_HTTP_PORT, PUBLIC: layerInfo.CL_PUBLIC_HTTP_PORT }
    }

    getNetworkEnvInfo(network: NetworkType): EnvCommonInfo {
        const info = this.projectStore.getItem('network-env') as NetworkEnvInfo;
        return info ? info[network] : {} as EnvCommonInfo;
    }

    getNetworkInfo(): NetworkInfo {
        return this.projectStore.getItem('network');
    }

    getProjectInfo(): ProjectInfo {
        return this.projectStore.getItem('project');
    }

    getSystemInfo(): SystemInfo {
        return this.pilotStore.getItem('system');
    }

    hasProjectFlag(name: string){
        const flags =  this.projectStore.getItem('flags') || {};
        return flags[name] !== undefined;
    }

    hasProjects() {
        const { projects } = this.pilotStore.getItem('pilot') as PilotInfo;
        return projects.length > 0;
    }

    setDockerEnvInfo(info: Partial<{ DOCKER_IMAGE_VERSION: string, DOCKER_USER_ID: string}>) {
        const oldInfo = this.projectStore.getItem('docker');
        this.projectStore.setItem('docker', { ...oldInfo, ...info });
    }

    setEnvCommonInfo(info: Partial<EnvCommonInfo>) {
        const oldInfo = this.projectStore.getItem('env');
        this.projectStore.setItem('env', { common: { ...oldInfo.common, ...info }, layers: oldInfo.layers });
    }

    setEnvInfo(info: DeepPartial<EnvInfo>) {
        const oldInfo = this.projectStore.getItem('env');
        this.projectStore.setItem('env', { ...oldInfo, ...info });
    }

    setEnvLayerInfo(layer: TessellationLayer, info: Partial<EnvLayerInfo>) {
        const envInfo = this.projectStore.getItem('env');
        const {common, layers} = envInfo;
        this.projectStore.setItem('env', { common, layers: { ...layers, [layer]: { ...layers[layer], ...info } } });

    }

    setNetworkEnvInfo(info: NetworkEnvInfo) {
        const oldInfo = this.projectStore.getItem('network-env');
        this.projectStore.setItem('network-env', { ...oldInfo, ...info });
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
}

export const configStore = new ConfigStore();

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type PilotInfo = {
    appDir: string;
    project: string;
    projects: string[];
}

export type EnvInfo = {
    common: EnvCommonInfo;
    layers: Record<TessellationLayer, EnvLayerInfo>;
}

export type EnvCommonInfo = {
    CL_APP_ENV: string;
    CL_EXTERNAL_IP: string;
    CL_GLOBAL_L0_PEER_HOST: string;
    CL_GLOBAL_L0_PEER_HTTP_PORT: string;
    CL_GLOBAL_L0_PEER_ID: string;
    CL_KEYALIAS: string;
    CL_KEYSTORE: string;
    CL_L0_PEER_HTTP_HOST: string;
    CL_L0_PEER_HTTP_PORT: string;
    CL_L0_PEER_ID: string;
    CL_L0_PEER_P2P_PORT: string;
    CL_L0_TOKEN_IDENTIFIER: string; // metagraph
    CL_PASSWORD: string;
}

export const commonEnvNames = {
    CL_APP_ENV: 1,
    CL_EXTERNAL_IP: 1,
    CL_GLOBAL_L0_PEER_HOST: 1,
    CL_GLOBAL_L0_PEER_HTTP_PORT: 1,
    CL_GLOBAL_L0_PEER_ID: 1,
    CL_KEYALIAS: 1,
    CL_KEYSTORE: 1,
    CL_L0_PEER_HTTP_HOST: 1,
    CL_L0_PEER_HTTP_PORT: 1,
    CL_L0_PEER_ID: 1,
    CL_L0_TOKEN_IDENTIFIER: 1,
    CL_PASSWORD: 1
}

export type EnvLayerInfo = {
    CL_CLI_HTTP_PORT: string;
    CL_DOCKER_JAVA_OPTS: string;
    CL_P2P_HTTP_PORT: string;
    CL_PUBLIC_HTTP_PORT: string;
}

export const layerEnvNames = {
    CL_CLI_HTTP_PORT: 1,
    CL_DOCKER_JAVA_OPTS: 1,
    CL_P2P_HTTP_PORT: 1,
    CL_PUBLIC_HTTP_PORT: 1,
}


export type SystemInfo = {
    cores: number;
    disk: string;
    isDockerInstalled: boolean;
    memory: string;
    platform: string;
}

export type NetworkType = 'integrationnet' | 'mainnet' | 'testnet';

export type ProjectInfo = {
    autoRestart: boolean;
    autoStart: boolean;
    autoUpdate: boolean;
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

export type NetworkEnvInfo = Record<NetworkType, EnvCommonInfo>;

export type PortInfo = {
    CLI: string;
    P2P: string;
    PUBLIC: string;
}

