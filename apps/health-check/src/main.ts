import {APP_ENV} from "./app-env.js";
import {healthCheck} from "./health-check.js";
import {logger} from "./logger.js";
import {TessellationLayer} from "./types.js";
import {backupUtils} from "./utils/backup-utils.js";
import {storeUtils} from "./utils/store-utils.js";

const supportedLayers = new Set([
    TessellationLayer.CL1,
    TessellationLayer.DL1,
    TessellationLayer.GL0,
    TessellationLayer.GL1,
    TessellationLayer.ML0,
]);

function isValidPort(port: string) {
    return port && !Number.isNaN(Number(port))
}

export async function main() {

    const layer = APP_ENV.CL_TESSELATION_LAYER as TessellationLayer;
    const publicPort: string = APP_ENV.CL_PUBLIC_HTTP_PORT;
    const cliPort = APP_ENV.CL_CLI_HTTP_PORT;

    if (!supportedLayers.has(layer) || !isValidPort(publicPort) || !isValidPort(cliPort)) {
        logger.log(`Health check is disabled due to bad ENV variable(s). CL_TESSELATION_LAYER=${layer}, CL_PUBLIC_HTTP_PORT=${publicPort}, CL_CLI_HTTP_PORT=${cliPort}. `);
        return;
    }

    const currentDateTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const {session:startTime='0'} = storeUtils.getNodeStatusInfo();
    if (startTime) {
        logger.log(`** Starting health check for ${layer} **`);
        logger.log(`[${currentDateTime}] - [UPTIME ${getUptime(Number(startTime))}]`);
    }
    else {
        logger.log(`${currentDateTime} - [Uptime 0s] Starting health check for ${layer} ...`);
    }

    healthCheck.check(layer)
        .then(() => {
            const {state:lastKnownState} = storeUtils.getNodeStatusInfo();
            logger.log(`${layer} is healthy. State: ${lastKnownState}`);
        })
        .catch((error: Error) => {
            if (error.message === 'RESTART_REQUIRED') {
                const {fatal:hadFatal=false} = storeUtils.getTimerInfo();
                if (!hadFatal) {
                    logger.fatal('Service Unhealthy - RESTART_REQUIRED');
                    storeUtils.setTimerInfo({fatal: true});
                    backupUtils.backupLogs();
                }

                throw new Error('Service Unhealthy');
            }

            logger.error(`[${APP_ENV.CL_TESSELATION_LAYER}] error: ${error.toString()}`);
        });

}

function getUptime(startTime: number) {
    const upTimeMs = Date.now() - startTime;
    const upTimeSec = Math.floor(upTimeMs / 1000);
    const hours = Math.floor(upTimeSec / 3600);
    const minutes = Math.floor((upTimeSec % 3600) / 60);
    const seconds = upTimeSec % 60;
    return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}
