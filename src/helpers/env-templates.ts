/* eslint-disable unicorn/numeric-separators-style */
import {EnvCommonInfo, EnvLayerInfo, NetworkType} from "../config-store.js";
import {TessellationLayer} from "../types.js";

export function getLayerEnvFileContent(layer: TessellationLayer, network: NetworkType, commonInfo: EnvCommonInfo, layerInfo: EnvLayerInfo) {
    return `
# Node
CL_EXTERNAL_IP=${commonInfo.CL_EXTERNAL_IP}
CL_DOCKER_JAVA_OPTS='${layerInfo.CL_DOCKER_JAVA_OPTS}'
CL_KEYSTORE='/app/key.p12'
CL_KEYALIAS='${commonInfo.CL_KEYALIAS}'
CL_PASSWORD='${commonInfo.CL_PASSWORD}'
CL_TESSELATION_LAYER=${layer}

# NETWORK
CL_APP_ENV=${commonInfo.CL_APP_ENV}
CL_COLLATERAL=${network === 'mainnet' ? 25000000000000 : 0}
CL_L0_PEER_HTTP_PORT=${commonInfo.CL_L0_PEER_HTTP_PORT}
CL_L0_PEER_HTTP_HOST=${commonInfo.CL_L0_PEER_HTTP_HOST}
CL_L0_PEER_ID=${commonInfo.CL_L0_PEER_ID}
CL_GLOBAL_L0_PEER_HTTP_PORT=${commonInfo.CL_GLOBAL_L0_PEER_HTTP_PORT}
CL_GLOBAL_L0_PEER_HOST=${commonInfo.CL_GLOBAL_L0_PEER_HOST}
CL_GLOBAL_L0_PEER_ID=${commonInfo.CL_GLOBAL_L0_PEER_ID}

# LAYER
CL_PUBLIC_HTTP_PORT=${layerInfo.CL_PUBLIC_HTTP_PORT}
CL_P2P_HTTP_PORT=${layerInfo.CL_P2P_HTTP_PORT}
CL_CLI_HTTP_PORT=${layerInfo.CL_CLI_HTTP_PORT}
`;
}

export function getKeyFileContent(commonInfo: EnvCommonInfo) {
    return `
export CL_KEYSTORE='${commonInfo.CL_KEYSTORE}'
export CL_KEYALIAS='${commonInfo.CL_KEYALIAS}'
export CL_PASSWORD='${commonInfo.CL_PASSWORD}'
`;
}