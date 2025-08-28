import {checkbox, input, number, select} from "@inquirer/prompts";
import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore, NetworkType} from "../config-store.js";
import {TessellationLayer} from "../types.js";
import {githubHelper} from "./github-helper.js";
import {projectHelper} from "./project-helper.js";

export const promptHelper = {

    async configureAutoRestart() {
        const answer = await input({
            default: 'y',
            message: 'Do you want to enable auto-restart? (y/n): '
        });
        configStore.setProjectInfo({ autoRestart: answer === 'y' });
    },

    async configureJavaMemoryArguments() {
        const {memory} = configStore.getSystemInfo();
        const {layersToRun, name} = configStore.getProjectInfo();

        const xmx = Number(memory);

        if (xmx === 8 && layersToRun.length > 1) {
            clm.warn('Minimum 8GB memory detected. Only a single layer will be allowed to run');
            await promptHelper.doYouWishToContinue();
            configStore.setProjectInfo({layersToRun: [layersToRun[0]]});
            configStore.setEnvLayerInfo(layersToRun[0], { CL_DOCKER_JAVA_OPTS: '-Xms1024M -Xmx7G -Xss256K' });
        }
        else if (name === 'hypergraph') {
            // prompt to use all detected memory
            let answer = await number({
                default: xmx-1,
                message: `How much of the detected memory (${xmx}GB) do you want to use?: `,
                validate: v => v !== undefined && v >= 4 && v <= xmx
            }) as number;

            if (answer === xmx) answer--;

            const subLayerMem = layersToRun.length > 1 ? Math.floor(answer / 3) : 0;
            const mainLayerMem = answer - subLayerMem;

            clm.postStep(`${layersToRun[0]} memory allocation: ${mainLayerMem}GB`);
            configStore.setEnvLayerInfo(layersToRun[0], { CL_DOCKER_JAVA_OPTS: `-Xms1024M -Xmx${mainLayerMem}G -Xss256K` });

            if (subLayerMem) {
                clm.postStep(`${layersToRun[1]} memory allocation: ${subLayerMem}GB`);
                configStore.setEnvLayerInfo(layersToRun[1], { CL_DOCKER_JAVA_OPTS: `-Xms1024M -Xmx${subLayerMem}G -Xss256K` });
            }
        }
    },

    async doYouWishToContinue(defaultAnswer: 'n' | 'y' = 'y') {
        const result = await input({
            default: defaultAnswer,
            message: 'Do you wish to continue? (y/n)',
            validate(value) {
                if (value.toLowerCase() === 'y' || value.toLowerCase() === 'n') {
                    return true;
                }

                return 'Please enter "y" or "n"';
            }
        });

        if (result.toLowerCase() === 'n') {
            process.exit(0);
        }

    },

    async selectLayers() {
        const { name } = configStore.getProjectInfo();
        const choices = name === 'hypergraph' ? ['gl0','gl1'] : ['ml0', 'cl1', 'dl1'];
        const result: TessellationLayer[] = await checkbox({ choices, message: `Select network layers to run for ${chalk.cyan(name)}:`, validate: v => v.length > 0 });

        configStore.setProjectInfo({layersToRun: result});
    },

    async selectNetwork() {
        const { supportedTypes } = configStore.getNetworkInfo();

        if (supportedTypes.length === 0) {
            throw new Error('No supported networks found');
        }

        if (supportedTypes.length === 1) {
            configStore.setNetworkInfo({type: supportedTypes[0], version: "latest"});
            configStore.setEnvCommonInfo(configStore.getNetworkEnvInfo(supportedTypes[0]));
            return;
        }

        const networkType = await select({
            choices: [
                {disabled: !supportedTypes.includes('mainnet'), name: 'Mainnet', value: 'mainnet'},
                {disabled: !supportedTypes.includes('testnet'), name: 'Testnet', value: 'testnet'},
                {disabled: !supportedTypes.includes('integrationnet'), name: 'Integrationnet', value: 'integrationnet'}
            ],
            message: 'Select network type:'
        });

        configStore.setNetworkInfo({type: networkType as NetworkType, version: "latest"});
        configStore.setEnvCommonInfo(configStore.getNetworkEnvInfo(networkType as NetworkType));
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
            await projectHelper.installHypergraph();
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
                await projectHelper.installEmbedded('dor');
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

                if (await githubHelper.hasAssetInRelease('node-pilot', userRepo)) {
                    await projectHelper.installFromGithub(userRepo);
                } else {
                    clm.warn(`The repository ${repo} does not contain a release asset with the name "node-pilot"`);
                    await this.selectProject();
                }
            }
        }
    }
}
