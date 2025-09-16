import {EnvCombinedInfo, EnvInfo} from "../config-store.js";
import {TessellationLayer} from "../types.js";

export function getLayerEnvFileContent(layer: TessellationLayer, env: EnvCombinedInfo) {
    return `
# Node
CL_EXTERNAL_IP=${env.CL_EXTERNAL_IP}
CL_DOCKER_JAVA_OPTS='${env.CL_DOCKER_JAVA_OPTS}'
CL_KEYSTORE='/app/key.p12'
CL_KEYALIAS='${env.CL_KEYALIAS}'
CL_PASSWORD='${env.CL_PASSWORD}'
CL_TESSELATION_LAYER=${layer}

# NETWORK
CL_APP_ENV=${env.CL_APP_ENV}
CL_COLLATERAL=${env.CL_COLLATERAL}
CL_L0_PEER_HTTP_PORT=${env.CL_L0_PEER_HTTP_PORT}
CL_L0_PEER_HTTP_HOST=${env.CL_L0_PEER_HTTP_HOST}
CL_L0_PEER_ID=${env.CL_L0_PEER_ID}
CL_GLOBAL_L0_PEER_HTTP_PORT=${env.CL_GLOBAL_L0_PEER_HTTP_PORT}
CL_GLOBAL_L0_PEER_HOST=${env.CL_GLOBAL_L0_PEER_HOST}
CL_GLOBAL_L0_PEER_ID=${env.CL_GLOBAL_L0_PEER_ID}

# LAYER
CL_PUBLIC_HTTP_PORT=${env.CL_PUBLIC_HTTP_PORT}
CL_P2P_HTTP_PORT=${env.CL_P2P_HTTP_PORT}
CL_CLI_HTTP_PORT=${env.CL_CLI_HTTP_PORT}
`;
}

export function getKeyFileContent(env: EnvInfo) {
    return `
export CL_KEYSTORE='${env.CL_KEYSTORE}'
export CL_KEYALIAS='${env.CL_KEYALIAS}'
export CL_PASSWORD='${env.CL_PASSWORD}'
`;
}

export function getObjectToEnvContent(obj: object) {
    return Object.entries(obj).map(([k, v]) => `${k}='${v}'`).join('\n') + '\n';
}