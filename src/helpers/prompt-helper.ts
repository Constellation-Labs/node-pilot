import {checkbox, input, select} from "@inquirer/prompts";
import chalk from "chalk";

import {configStore, NetworkType} from "../config-store.js";
import {TessellationLayer} from "../types.js";

export const promptHelper = {

    async confirmPrompt(msg: string) {
        const result = await input({
            default: 'y',
            message: `${msg} (y/n)`,
            validate(value) {
                if (value.toLowerCase() === 'y' || value.toLowerCase() === 'n') {
                    return true;
                }

                return 'Please enter "y" or "n"';
            }
        });

        return result.toLowerCase() !== 'n';
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
