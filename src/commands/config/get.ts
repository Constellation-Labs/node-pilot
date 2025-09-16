import {Args, Command} from '@oclif/core'

import {clm} from "../../clm.js";
import {
    configStore,
    EnvLayerInfo,
    EnvNetworkInfo,
    layerEnvNames,
    networkEnvNames
} from "../../config-store.js";
import {configHelper} from "../../helpers/config-helper.js";
import {TessellationLayer} from "../../types.js";

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

    getKeyInfo() {
        const {dagAddress, nodeId} = configStore.getProjectInfo();
        const{CL_KEYALIAS, CL_KEYSTORE} = configStore.getEnvInfo();
        return {
            KEY_ALIAS: CL_KEYALIAS,
            KEY_FILE: CL_KEYSTORE,
            NODE_ADDRESS: dagAddress,
            NODE_ID: nodeId,
        }
    }

    public async run(): Promise<void> {
        configHelper.assertProject('No configuration found. ');
        const {args} = await this.parse(ConfigGet);
        // const info = configStore.getEnvInfo();
        const {layersToRun} = configStore.getProjectInfo();
        const {type: network} = configStore.getNetworkInfo();
        const networkEnv = configStore.getEnvNetworkInfo(network)
        // const networkProp = info.network as Record<string, string>;
        // const layers = info.layers as Record<string, Record<string, string>>;
        const gl = (l: TessellationLayer) => configStore.getEnvLayerInfo(network,l);
        if(Object.keys(args).length === 0 || args.name === undefined) {
            const networkList = Object.keys(networkEnvNames).sort().map(k => ({name: k, value: networkEnv[k as keyof EnvNetworkInfo]}));
            const layersList = layersToRun.map(l => (Object.keys(layerEnvNames).map(k => ({name: `${l}:${k}`, value: gl(l)[k as keyof EnvLayerInfo]}))));
            const keyInfo = this.getKeyInfo();
            const keyInfoList = Object.keys(keyInfo).map(k => ({name: 'key:'+k, value: keyInfo[k as keyof typeof keyInfo]}));

            configHelper.showEnvInfoList(networkList);
            configHelper.showEnvInfoList(keyInfoList);
            configHelper.showEnvInfoList(layersList.flat());
        }
        else if (args.name.includes(':')) {
            const [layer, name] = args.name.split(':') as [string | TessellationLayer, string];
            if (layer === 'key') {
                const keyInfo = this.getKeyInfo();
                if (Object.hasOwn(keyInfo, name)) {
                    configHelper.showEnvInfo(args.name, keyInfo[name as keyof typeof keyInfo]);
                }
                else {
                    clm.warn('Invalid key property. Valid properties are: ' + Object.keys(keyInfo).join(', '));
                }

            }
            else if(!layersToRun.includes(layer as TessellationLayer)) {
                clm.warn(`Layer ${layer} is not running. Valid layers are: ` + layersToRun.join(', '));
            }
            else if (Object.hasOwn(layerEnvNames, name)) {
                configHelper.showEnvInfo(args.name, gl(layer as TessellationLayer)[name as keyof EnvLayerInfo]);
            }
            else {
                clm.warn('Invalid layer property. Valid properties are: ' + Object.keys(layerEnvNames).join(', '));
            }
        }
        else if(args.name === 'key') {
            const keyInfo = this.getKeyInfo();
            const keyInfoList = Object.keys(keyInfo).map(k => ({name: 'key:'+k, value: keyInfo[k as keyof typeof keyInfo]}));
            configHelper.showEnvInfoList(keyInfoList);
        }
        else if (layersToRun.includes(args.name as TessellationLayer)) {
            const layer = args.name as TessellationLayer;
            const list = Object.keys(layerEnvNames).map(k => ({name: `${layer}:${k}`, value: gl(layer)[k as keyof EnvLayerInfo]}));
            configHelper.showEnvInfoList(list);
        }
        else {

            if (!Object.hasOwn(networkEnvNames, args.name)) {
                clm.warn('Invalid network-wide property. Valid properties are: ' + Object.keys(networkEnvNames).join(', '));
                return;
            }

            configHelper.showEnvInfo(args.name, networkEnv[args.name as keyof EnvNetworkInfo]);
        }
    }
}
