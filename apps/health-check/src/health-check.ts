import {logger} from "./logger.js";
import {NodeState, TessellationLayer, TimerInfo} from "./types.js";
import {clusterUtils} from "./utils/cluster-utils.js";
import {nodeUtils} from "./utils/node-utils.js";
import {storeUtils} from "./utils/store-utils.js";


class HealthCheck {

    async check(layer: TessellationLayer) {

        if (layer === TessellationLayer.GL0 || layer === TessellationLayer.GL1) {
            return this.checkGlobalLayer(layer);
        }

        if (layer === TessellationLayer.ML0 || layer === TessellationLayer.DL1 || layer === TessellationLayer.CL1) {
            return this.checkMetagraph(layer);
        }

        console.warn(`Health check for service ${layer} is not implemented.`);
    }

    async checkGlobalLayer(layer: TessellationLayer) {

        const state = await nodeUtils.getCurrentState();

        if (state === NodeState.Leaving) {
            return;
        }

        const {hasJoined = false} = storeUtils.getNodeStatusInfo();

        if (hasJoined) {
            await nodeUtils.checkUnrecoverableStates(layer, state);
            await clusterUtils.checkForSessionFork();
            await clusterUtils.checkLatestOrdinals();
            await clusterUtils.checkLatestSnapshotHash();
        }
        else {
            await this.checkForStalledState(layer, state);
        }
    }

    async checkMetagraph(layer: TessellationLayer) {

        const state = await nodeUtils.getCurrentState();

        await nodeUtils.checkUnrecoverableStates(layer, state);

        if (layer === TessellationLayer.CL1) {
            await this.checkObservingState(layer, state);
        }

        if (layer === TessellationLayer.ML0 && state === NodeState.Ready) {
            // verify ordinal snapshot hashes match with cluster
        }
    }

    private async checkForStalledState(layer: TessellationLayer, currentState: NodeState) {

        if (currentState === NodeState.ReadyToJoin ||  currentState === NodeState.DownloadInProgress) {
            return;
        }

        if (currentState === NodeState.Offline) {
            throw new Error('RESTART_REQUIRED');
        }

        const lastState: string = storeUtils.getLastState();

        logger.log(`Checking for stalled state. lastState: ${lastState}, currentState: ${currentState}...`);

        if (lastState === currentState) {
            const property = currentState + 'StartTime';
            const timerInfo = storeUtils.getTimerInfo();
            const startTime = (timerInfo[property as keyof TimerInfo] || 0) as number;
            const currentTime = Math.floor(Date.now() / 1000);

            if (startTime === 0) {
                storeUtils.setTimerInfo({[property]: currentTime});
                logger.log(`${layer} has repeated ${currentState} state. Starting 5-minute timeout.`);
            } else {
                const timeDiff = currentTime - startTime;

                if (timeDiff >= 300) {
                    await nodeUtils.leaveCluster();
                    throw new Error(`${layer} has been in ${currentState} state for more than 5 minutes - exiting...`);
                } else {
                    const remainingTime = 300 - timeDiff;
                    logger.log(
                        `${layer} is in ${currentState} state for ${timeDiff}s (${remainingTime}s remaining before timeout).`
                    );
                }
            }
        }
    }

    private async checkObservingState(layer: TessellationLayer, state: NodeState) {

        if (state === NodeState.Observing) {
            const currentTime = Math.floor(Date.now() / 1000);
            const {observingStartTime: startTime = 0} = storeUtils.getTimerInfo();

            if (startTime === 0) {
                storeUtils.setTimerInfo({observingStartTime: currentTime});
                console.log(`${layer} entered Observing state. Starting 5-minute timeout. State: ${state}`);
            } else {
                const timeDiff = currentTime - startTime;

                if (timeDiff >= 300) {
                    throw new Error(`${layer} has been in Observing state for more than 5 minutes - exiting...`);
                } else {
                    const remainingTime = 300 - timeDiff;
                    console.log(
                        `${layer} is in Observing state for ${timeDiff}s (${remainingTime}s remaining before timeout). State: ${state}`
                    );
                }
            }
        } else {
            storeUtils.setTimerInfo({observingStartTime: 0});
        }
    }
}

export const healthCheck = new HealthCheck();