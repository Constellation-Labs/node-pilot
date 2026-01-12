
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
import {pilotManager} from "./pilot-manager.js";
import {promptHelper} from "./prompt-helper.js";

export const projectHelper = {

    async cleanup(layers: TessellationLayer[], deleteData: boolean, deleteLogs: boolean, deleteJars: boolean) {
        await promptHelper.shutdownNodeIfRunning();

        clm.preStep('Requesting sudo permission to remove files...');

        for (const layer of layers) {
            if (deleteData) {
                // eslint-disable-next-line no-await-in-loop
                await shellService.runProjectCommand(`sudo rm -rf ${layer}/data`);
                if (layer === 'gl0') {
                    this.prepareDataFolder();
                    configStore.setProjectFlag('discordChecked', false);
                }
            }

            if (deleteLogs) {
                // eslint-disable-next-line no-await-in-loop
                await shellService.runProjectCommand(`sudo rm -rf ${layer}/logs`);
            }

            if (deleteJars) {
                // eslint-disable-next-line no-await-in-loop
                await shellService.runProjectCommand(`sudo rm -rf dist`);
            }
        }

        clm.postStep('Cleanup complete');
    },

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

    async installEmbedded (embeddedName: string, projectName: string, projectType: 'hypergraph' | 'metagraph')   {
        const projectFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../projects/${embeddedName}`);

        if (!fs.existsSync(projectFolder)) {
            clm.error(`Project folder not found: ${projectFolder}`);
        }

        await this.installProject(projectName, projectType, projectFolder);
        // this.installServiceScripts();

        // Set the project version to match the latest Pilot version. This prevents previous migration scripts from running.
        configStore.setProjectInfo({version: configStore.getPilotReleaseInfo().version});
    },

    //  curl -s https://api.github.com/repos/Constellation-Labs/pacaswap-metagraph/releases/latest | jq -r '.assets[] | select(.name | contains("node-pilot"))'
    //  use .tag_name for the release version
    async installFromGithub (_repo: string) {
        throw new Error('installFromGithub - Not implemented');
    },

    async installHypergraph() {
        const name = pilotManager.getActiveProject() || 'hypergraph';
        await this.installEmbedded('hypergraph', name, 'hypergraph');
        this.prepareDataFolder();
        this.importEnvFiles();
    },

    async installProject(name: string, type: 'hypergraph' | 'metagraph', projectFolder: string) {

        await pilotManager.applyNewProjectStore(name, type);

        const {projectDir} = configStore.getProjectInfo();

        clm.debug(`Installing project from ${projectFolder} to ${projectDir}`);

        fs.cpSync(projectFolder, projectDir, {recursive: true});
    },

    installServiceScripts() {
        const scriptFile = path.join(pilotManager.getAppDir(), 'scripts', 'restart-unhealthy.sh');
        if (!fs.existsSync(scriptFile)) {
            const content = `#!/usr/bin/env bash
            
docker ps -q -f health=unhealthy | xargs --no-run-if-empty docker restart
`;
            fs.writeFileSync(scriptFile, content);
            fs.chmodSync(scriptFile, '755');
            clm.postStep(`Created script at ${scriptFile}`);
        }
    },

    prepareDataFolder() {
        const {projectDir} = configStore.getProjectInfo();

        // Create gl0 folder for the fast-forward feature before Docker does
        const gl0DataDir = path.join(projectDir,'gl0','data');

        if (!fs.existsSync(gl0DataDir)) {
            fs.mkdirSync(path.join(gl0DataDir,'incremental_snapshot'), {recursive: true});
            fs.mkdirSync(path.join(gl0DataDir,'snapshot_info'));
            fs.mkdirSync(path.join(gl0DataDir,'tmp'));
        }
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
                await this.installEmbedded('dor', 'dor', 'metagraph');
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
    },

    updateDockerEnv() {

        const {type: network} = configStore.getNetworkInfo();

        let CL_GL0_PUBLIC_PORT = '';
        let CL_GL0_P2P_PORT = '';
        let CL_GL1_PUBLIC_PORT = '';
        let CL_GL1_P2P_PORT = '';

        const {layersToRun} = configStore.getProjectInfo();

        for (const layer of layersToRun) {
            const info = configStore.getEnvLayerInfo(network, layer);
            switch (layer) {
                case 'gl0': {
                    CL_GL0_P2P_PORT = info.CL_P2P_HTTP_PORT;
                    CL_GL0_PUBLIC_PORT = info.CL_PUBLIC_HTTP_PORT;
                    break;
                }

                case 'gl1': {
                    CL_GL1_P2P_PORT = info.CL_P2P_HTTP_PORT;
                    CL_GL1_PUBLIC_PORT = info.CL_PUBLIC_HTTP_PORT;
                    break;
                }
            }
        }

        configStore.setDockerEnvInfo({
            CL_GL0_P2P_PORT,  CL_GL0_PUBLIC_PORT,
            CL_GL1_P2P_PORT, CL_GL1_PUBLIC_PORT
        });
    },

    upgradeEmbedded (name: string)   {
        const projectFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../projects/${name}`);

        if (!fs.existsSync(projectFolder)) {
            clm.error(`Project folder not found: ${projectFolder}`);
        }

        this.upgradeProject(name, projectFolder);
    },

    upgradeHypergraph() {
        this.upgradeEmbedded('hypergraph');

        this.importEnvFiles();

        this.updateDockerEnv();

        this.installServiceScripts();
    },

    upgradeProject(name: string, projectFolder: string) {
        const {projectDir} = configStore.getProjectInfo();

        clm.debug(`Upgrading project from ${projectFolder} to ${projectDir}`);

        fs.cpSync(projectFolder, projectDir, {recursive: true});
    }
}

