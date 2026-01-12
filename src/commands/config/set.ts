import {Args, Command} from '@oclif/core'
import chalk from "chalk";

import {clm} from "../../clm.js";
import {configStore, layerEnvNames, networkEnvNames} from "../../config-store.js";
import {configHelper} from "../../helpers/config-helper.js";
import {TessellationLayer} from "../../types.js";

export default class ConfigSet extends Command {
    static override args = {
        name: Args.string({description: 'configuration name', required: true}),
        value: Args.string({description: 'the value to set to the configuration', required: true}),
    }
    static override description = 'Set a configuration setting'
    static override examples = [
        '<%= config.bin %> <%= command.id %> CL_EXTERNAL_IP 127.0.0.1',
        '<%= config.bin %> <%= command.id %> gl0:CL_PUBLIC_HTTP_PORT 9000',
    ]

    public async run(): Promise<void> {
        configHelper.assertProject('No configuration found. ');
        const {args} = await this.parse(ConfigSet)
        const {layersToRun} = configStore.getProjectInfo();

        if (args.name.startsWith('key:')) {
            clm.error(`Key properties cannot be set directly. Please run ${chalk.cyan('cpilot config')} and select ${chalk.cyan('Key Info')} to manage the key file.`);
        }

        if (args.name.startsWith('docker:')) {
            // Note: Multiple places need to be updated (LayerInfo and DockerInfo). It's easier to require the user to run the config command to update docker properties.
            clm.error(`Docker ports cannot be set directly. Please run ${chalk.cyan('cpilot config')} and select ${chalk.cyan('Container Ports')} to manage.`);
        }

        const {type: network} = configStore.getNetworkInfo();

        if (args.name.includes(':')) {
            const [layer, name] = args.name.split(':');

            if (!layersToRun.includes(layer as TessellationLayer)) {
                clm.error(`Invalid layer: ${layer}. Available layers: ${layersToRun.join(',')}`);
            }

            const validLayer = layer as TessellationLayer;

            if (!Object.hasOwn(layerEnvNames, name)) {
                clm.error(`Invalid layer configuration name: ${name}. Valid names are: ${Object.keys(layerEnvNames).join(', ')}`);
            }

            configStore.setEnvLayerInfo(network, validLayer, {[name]: args.value})

        } else {
            const {name} = args;

            if (!Object.hasOwn(networkEnvNames, name)) {
                clm.error(`Invalid configuration name: ${name}. Valid names are: ${Object.keys(networkEnvNames).join(', ')}`);
            }

            configStore.setEnvNetworkInfo(network, {[name]: args.value});
        }


    }
}
