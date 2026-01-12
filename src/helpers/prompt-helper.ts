import {checkbox, input, number, select} from "@inquirer/prompts";
import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore, NetworkType} from "../config-store.js";
import {dockerService} from "../services/docker-service.js";
import {nodeService} from "../services/node-service.js";
import {TessellationLayer} from "../types.js";

export const promptHelper = {

    async configurePorts() {
        const defaults = { cl1: [9300,9301], dl1: [9400,9401], gl0: [9000,9001], gl1: [9100,9101], ml0: [9200,9201] };
        const { layersToRun } = configStore.getProjectInfo();
        const {type: network} = configStore.getNetworkInfo();
        for (const layer of layersToRun) {
            // eslint-disable-next-line no-await-in-loop
            const port1 = await number({ default: defaults[layer][0], message: `${layer} Public Port:`, required: true, validate: v => v !== undefined && v > 0 && v <= 65_535 });
            // eslint-disable-next-line no-await-in-loop
            const port2 = await number({ default: defaults[layer][1], message: `${layer} P2P Port:`, required: true, validate: v => v !== undefined && v > 0 && v <= 65_535 });
            configStore.setEnvLayerInfo(network, layer, { CL_P2P_HTTP_PORT: port2.toString(), CL_PUBLIC_HTTP_PORT: port1.toString()});
        }
    },

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
        const { name, type } = configStore.getProjectInfo();
        const choices = type === 'hypergraph' ? ['gl0','gl1'] : ['ml0', 'cl1', 'dl1'];
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
        configStore.setProjectFlag('javaMemoryChecked', false);
    },

    async shutdownNodeIfRunning() {
        if (await dockerService.isRunning()) {
            clm.preStep('The validator node must be stopped first.')
            await promptHelper.doYouWishToContinue();
            await nodeService.leaveClusterAllLayers().catch();
            await dockerService.dockerDown();
        }
    }
}
