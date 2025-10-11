
import {input, select} from "@inquirer/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from 'node:url'

import {clm} from "../clm.js";
import {configStore, EnvLayerInfo, EnvNetworkInfo, NetworkType} from "../config-store.js";
import {githubService} from "../services/github-service.js";
import {shellService} from "../services/shell-service.js";
import {TessellationLayer} from "../types.js";
import {configHelper} from "./config-helper.js";
import {getLayerEnvFileContent} from "./env-templates.js";

export const projectHelper = {

    async generateLayerEnvFiles(layers?: TessellationLayer[]) {
        const {layersToRun, projectDir} = configStore.getProjectInfo();
        const {type: network} = configStore.getNetworkInfo();
        const envInfo = configStore.getEnvInfo();
        const envNetworkInfo = configStore.getEnvNetworkInfo(network);

        layers = layers || layersToRun;

        for (const layer of layers) {
            const filePath = path.join(projectDir, `${layer}.env`);
            const envLayerInfo = configStore.getEnvLayerInfo(network, layer);
            const fileContents = getLayerEnvFileContent(layer, { ...envInfo, ...envNetworkInfo, ...envLayerInfo });
            clm.debug(`Writing layer env file: ${filePath}`);
            fs.writeFileSync(filePath, fileContents)
        }
    },

    importEnvFiles() {
        const {projectDir} = configStore.getProjectInfo();

        const possibleNetworks: NetworkType[] = ['mainnet', 'testnet', 'integrationnet'];
        const possibleLayers: TessellationLayer[] = ['gl0', 'gl1', 'ml0', 'cl1', 'dl1'];

        const supportedTypes: NetworkType[] = [];

        for (const network of possibleNetworks) {
            const filePath = path.join(projectDir, 'networks', network, 'network.env');
            if (fs.existsSync(filePath)) {
                supportedTypes.push(network);
                configStore.setEnvNetworkInfo(network, configHelper.parseEnvFile(filePath) as EnvNetworkInfo);
            }

            for (const layer of possibleLayers) {
                const filePath = path.join(projectDir, 'networks', network, `${layer}.env`);
                if (fs.existsSync(filePath)) {
                    configStore.setEnvLayerInfo(network, layer, configHelper.parseEnvFile(filePath) as EnvLayerInfo);
                }
            }
        }

        if (supportedTypes.length === 0) {
            clm.error('No supported networks found in the project folder.');
        }

        configStore.setNetworkInfo({supportedTypes});


        // eslint-disable-next-line no-warning-comments
        // TODO: verify all required env variables are present
    },

    async installEmbedded (name: string)   {
        const projectFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../projects/${name}`);

        if (!fs.existsSync(projectFolder)) {
            clm.error(`Project folder not found: ${projectFolder}`);
        }

        await this.installProject(name, projectFolder);
    },

    //  curl -s https://api.github.com/repos/Constellation-Labs/pacaswap-metagraph/releases/latest | jq -r '.assets[] | select(.name | contains("node-pilot"))'
    //  use .tag_name for the release version
    async installFromGithub (_repo: string) {
        throw new Error('installFromGithub - Not implemented');
    },

    async installHypergraph() {
        await this.installEmbedded('hypergraph');

        const {projectDir} = configStore.getProjectInfo();
        const {platform} = configStore.getSystemInfo();

        // Create gl0 folder for the fast-forward feature before Docker does

        if (platform === 'linux') {
            const layerDir = path.join(projectDir,'gl0');
            // set permission for group "docker" on the layer folder and any subfolders created later
            await shellService.runCommand(`sudo setfacl -m g:docker:rwX -dm g:docker:rwX ${layerDir}`)
        }
        else {
            const gl0DataDir = path.join(projectDir,'gl0','data');
            fs.mkdirSync(path.join(gl0DataDir,'incremental_snapshot'), {recursive: true});
            fs.mkdirSync(path.join(gl0DataDir,'snapshot_info'));
            fs.mkdirSync(path.join(gl0DataDir,'tmp'));
        }

        this.importEnvFiles();
    },

    async installProject(name: string, projectFolder: string) {

        if (!configStore.hasProjects()) {
            // On first install, copy scripts
            const scriptsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../scripts`);
            const projectDir = path.join(configStore.getAppDir(), 'scripts');
            clm.debug(`Installing node pilot scripts from ${scriptsFolder} to ${projectDir}`);
            fs.mkdirSync(projectDir, {recursive: true});
            fs.cpSync(scriptsFolder, projectDir, {recursive: true});
        }

        await configStore.applyNewProjectStore(name);

        const {projectDir} = configStore.getProjectInfo();

        clm.debug(`Installing project from ${projectFolder} to ${projectDir}`);

        fs.cpSync(projectFolder, projectDir, {recursive: true});
    },

    async selectProject() {
        // prompt user to install hypergraph or metagraph
        const networkType = await select({
            choices: [
                {name: 'Hypergraph (Global layer)', value: 'hypergraph'},
                {disabled: true, name: 'Metagraph (Dor, Pacaswap, and more)', value: 'metagraph' },
            ],
            message: 'Select network:'
        });

        if (networkType === 'hypergraph') {
            await this.installHypergraph();
        } else if (networkType === 'metagraph') {
            const project = await select({
                choices: [
                    {name: 'Dor', value: 'dor'},
                    {name: 'Custom (Enter repo)', value: 'custom'},
                ],
                message: 'Select metagraph:'
            });

            const ghRepoRegex = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:-?[A-Za-z0-9]){0,38})\/([A-Za-z0-9._-]+)(?:\.git)?\/?$/;

            if (project === 'dor') {
                await this.installEmbedded('dor');
            } else if (project === 'custom') {
                let repo = await input({
                    message: `Enter Github repository URL:`,
                    validate(value: string) {

                        const m = value.trim().match(ghRepoRegex);
                        if (m) return true;
                        return 'Please enter a valid Github repo URL (e.g., https://github.com/user/repo or .git)';
                    }
                });

                if (repo.endsWith('.git')) repo = repo.slice(0, -4);

                const m = repo.trim().match(ghRepoRegex);
                const userRepo = `${m![1]}/${m![2]}`; // owner/repo

                clm.preStep(`Installing from Github repository: ${chalk.cyan(userRepo)}`);

                if (await githubService.hasAssetInRelease('node-pilot', userRepo)) {
                    await this.installFromGithub(userRepo);
                } else {
                    clm.warn(`The repository ${repo} does not contain a release asset with the name "node-pilot"`);
                    await this.selectProject();
                }
            }
        }
    }
}

