import {Args, Command} from '@oclif/core'

import {commonEnvNames, configStore, layerEnvNames} from "../../config-store.js";
import {configHelper} from "../../helpers/config-helper.js";

export default class ConfigGet extends Command {
  static override args = {
    name: Args.string({description: 'configuration to get'}),
  }
  static override description = 'Show all configuration settings or a specific one'
  static override examples = [
        '<%= config.bin %> <%= command.id %>',
        '<%= config.bin %> <%= command.id %> CL_EXTERNAL_IP',
        '<%= config.bin %> <%= command.id %> gl0:CL_PUBLIC_HTTP_PORT',
  ]

    public async run(): Promise<void> {
        configHelper.assertProject('No configuration found. ');
        const {args} = await this.parse(ConfigGet);
        const info = configStore.getEnvInfo();
        const {layersToRun} = configStore.getProjectInfo() as {layersToRun: string[]};
        const common = info.common as Record<string, string>;
        const layers = info.layers as Record<string, Record<string, string>>;
        if(Object.keys(args).length === 0 || args.name === undefined) {
            const commonsList = Object.keys(commonEnvNames).sort().map(k => ({name: k, value: common[k]}))
            const layersList = layersToRun.map(l => (Object.keys(layerEnvNames).map(k => ({name: `${l}:${k}`, value: layers[l][k]}))));
            // const layersList = layersToRun.map(l => (Object.keys(layerEnvNames).map(k => `${l}:${k}="${green(layers[l][k] || '')}"`)))

            configHelper.showEnvInfoList(commonsList);
            configHelper.showEnvInfoList(layersList.flat());
        }
        else if (args.name.includes(':')) {
            const [layer, name] = args.name.split(':');
            configHelper.showEnvInfo(args.name, layers[layer][name]);
        }
        else {
            // const props = keyof EnvCommonInfo
            configHelper.showEnvInfo(args.name, common[args.name]);
        }
    }
}
