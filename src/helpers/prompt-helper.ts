import {checkbox, input, number, select} from "@inquirer/prompts";
import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore, NetworkType} from "../config-store.js";
import {TessellationLayer} from "../types.js";

export const promptHelper = {

    async configureJavaMemoryArguments() {
        const {memory} = configStore.getSystemInfo();
        const {layersToRun, name} = configStore.getProjectInfo();
        const {type: currentNetwork} = configStore.getNetworkInfo();

        const xmx = Number(memory);

        if (xmx === 8 && layersToRun.length > 1) {
            clm.warn('Minimum 8GB memory detected. Only a single layer will be allowed to run');
            await promptHelper.doYouWishToContinue();
            configStore.setProjectInfo({layersToRun: [layersToRun[0]]});
            configStore.setEnvLayerInfo(currentNetwork, layersToRun[0], { CL_DOCKER_JAVA_OPTS: '-Xms1024M -Xmx7G -Xss256K' });
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

            const {supportedTypes} = configStore.getNetworkInfo();

            for (const type of supportedTypes) {
                const network = type.toUpperCase();
                const logMethod = type === currentNetwork ? clm.postStep : clm.debug;
                logMethod(`${network}:: ${layersToRun[0]} memory allocation: ${mainLayerMem}GB`);
                configStore.setEnvLayerInfo(type, layersToRun[0], { CL_DOCKER_JAVA_OPTS: `-Xms1024M -Xmx${mainLayerMem}G -Xss256K` });

                if (subLayerMem) {
                    logMethod(`${network}:: ${layersToRun[1]} memory allocation: ${subLayerMem}GB`);
                    configStore.setEnvLayerInfo(type, layersToRun[1], { CL_DOCKER_JAVA_OPTS: `-Xms1024M -Xmx${subLayerMem}G -Xss256K` });
                }
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
            // configStore.setEnvNetworkInfo(configStore.getNetworkEnvInfo(supportedTypes[0]));
            return;
        }

        const networkType = await select({
            choices: [
                {disabled: !supportedTypes.includes('mainnet'), name: 'Mainnet', value: 'mainnet'},
                {disabled: !supportedTypes.includes('testnet'), name: 'Testnet', value: 'testnet'},
                {disabled: !supportedTypes.includes('integrationnet'), name: 'Integrationnet', value: 'integrationnet'}
            ],
            message: 'Select network type:'
        }) as NetworkType;

        configStore.setNetworkInfo({type: networkType, version: "latest"});
        configStore.setProjectFlag('duplicateNodeIdChecked', false);
        configStore.setProjectFlag('seedListChecked', false);
    }
}
