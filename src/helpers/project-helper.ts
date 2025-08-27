
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from 'node:url'

import {clm} from "../clm.js";
import {configStore, EnvCommonInfo, EnvLayerInfo, NetworkType} from "../config-store.js";
import {TessellationLayer} from "../types.js";
import {configHelper} from "./config-helper.js";
import {getLayerEnvFileContent} from "./env-templates.js";

export const projectHelper = {

    async generateLayerEnvFiles(layers?: TessellationLayer[]) {
        const {layersToRun, projectDir} = configStore.getProjectInfo();
        const {type} = configStore.getNetworkInfo();
        const commonInfo = configStore.getEnvCommonInfo();

        layers = layers || layersToRun;

        for (const n of layers) {
            const filePath = path.join(projectDir, `${n}.env`);
            const envInfo = configStore.getEnvLayerInfo(n);
            const fileContents = getLayerEnvFileContent(n, type, commonInfo, envInfo);
            clm.debug(`Writing layer env file: ${filePath}`);
            fs.writeFileSync(filePath, fileContents)
        }
    },

    async importLayerEnvFiles() {
        const {projectDir} = configStore.getProjectInfo();

        const possibleLayers: TessellationLayer[] = ['gl0', 'gl1', 'ml0', 'cl1', 'dl1'];

        for (const n of possibleLayers) {
            const filePath = path.join(projectDir, 'layers', `${n}.env`);
            if (fs.existsSync(filePath)) {
                configStore.setEnvLayerInfo(n, configHelper.parseEnvFile(filePath) as EnvLayerInfo);
            }
        }
    },

    async importNetworkEnvFiles() {
        const {projectDir} = configStore.getProjectInfo();

        const possibleNetworks: NetworkType[] = ['mainnet', 'testnet', 'integrationnet'];
        const supportedTypes: NetworkType[] = [];
        const networkEnvInfo = {} as Record<NetworkType, EnvCommonInfo> ;

        for (const n of possibleNetworks) {
            const filePath = path.join(projectDir, 'networks', `${n}.env`);
            if (fs.existsSync(filePath)) {
                supportedTypes.push(n);
                networkEnvInfo[n] = configHelper.parseEnvFile(filePath) as EnvCommonInfo;
            }
        }

        if (supportedTypes.length === 0) {
            clm.error('No supported networks found in the project folder.');
        }

        configStore.setNetworkInfo({supportedTypes});
        configStore.setNetworkEnvInfo(networkEnvInfo);

        // eslint-disable-next-line no-warning-comments
        // TODO: verify all required env variables are present

    },

    async installEmbedded (name: string)   {
        const projectFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../projects/${name}`);

        if (!fs.existsSync(projectFolder)) {
            clm.error(`Project folder not found: ${projectFolder}`);
        }

        await configStore.applyNewProjectStore(name);

        const {projectDir} = configStore.getProjectInfo();

        clm.debug(`Installing project from ${projectFolder} to ${projectDir}`);

        fs.cpSync(projectFolder, projectDir, {recursive: true});
    },

    //  curl -s https://api.github.com/repos/Constellation-Labs/pacaswap-metagraph/releases/latest | jq -r '.assets[] | select(.name | contains("node-pilot"))'
    //  use .tag_name for the release version
    async installFromGithub (_repo: string) {
        throw new Error('installFromGithub - Not implemented');
    },

    async installHypergraph() {
        await this.installEmbedded('hypergraph');

        // Set hypergraph layer defaults
        configStore.setEnvLayerInfo('gl0', {
            CL_CLI_HTTP_PORT: '9002', CL_DOCKER_JAVA_OPTS: '-Xms1024M -Xmx7G -Xss256K', CL_P2P_HTTP_PORT: '9001', CL_PUBLIC_HTTP_PORT: '9000'
        });

        configStore.setEnvLayerInfo('gl1', {
            CL_CLI_HTTP_PORT: '9102', CL_DOCKER_JAVA_OPTS: '-Xms1024M -Xmx3G -Xss256K', CL_P2P_HTTP_PORT: '9101', CL_PUBLIC_HTTP_PORT: '9100'
        });

        await this.importNetworkEnvFiles();
        await this.importLayerEnvFiles();

    }
}

