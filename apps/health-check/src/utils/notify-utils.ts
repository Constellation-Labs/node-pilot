import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {storeUtils} from "./store-utils.js";

const NOTIFY_SERVER = 'http://34.197.47.192:3008/notify'

export const notifyUtils = {

    async notify(msg: string) {
        const {webHookEnabled=false} = storeUtils.getUserInfo();

        if (webHookEnabled) {
            const network = APP_ENV.CL_APP_ENV;
            msg = `${APP_ENV.CL_EXTERNAL_IP} v${APP_ENV.PILOT_VERSION} - ${msg}`;
            // post using fetch
            await fetch(NOTIFY_SERVER, {
                body: JSON.stringify({
                    msg,
                    network
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
                method: 'POST'
            }).catch(error => {
                logger.error(`Failed to send alert- ${error}`);
            });
        }
    }
};