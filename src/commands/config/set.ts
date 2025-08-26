import {Args, Command} from '@oclif/core'

import {commonEnvNames, configStore, layerEnvNames} from "../../config-store.js";
import {TessellationLayer} from "../../types.js";
import {configHelper} from "../../helpers/config-helper.js";

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

    logErrorAndExit(message: string) {
        this.log(message);
        this.exit(0);
    }

    public async run(): Promise<void> {
        configHelper.assertProject('No configuration found. ');
        const {args} = await this.parse(ConfigSet)
        const {layersToRun} = configStore.getProjectInfo();

        if (args.name.includes(':')) {
            const [layer, name] = args.name.split(':');

            if (!layersToRun.includes(layer as TessellationLayer)) {
                this.logErrorAndExit(`Invalid layer: ${layer}. Available layers: ${layersToRun.join(',')}`);
            }

            const validLayer = layer as TessellationLayer;

            if (!Object.hasOwn(layerEnvNames, name)) {
                this.logErrorAndExit(`Invalid layer configuration name: ${name}`);
            }

            configStore.setEnvLayerInfo(validLayer, {[name]: args.value})

        } else {
            const {name} = args;

            if (!Object.hasOwn(commonEnvNames, name)) {
                this.logErrorAndExit(`Invalid configuration name: ${name}`);
            }

            configStore.setEnvCommonInfo({[name]: args.value});
        }


    }
}
