import {APP_ENV} from "../app-env.js";
import {storeUtils} from "./store-utils.js";

const NOTIFY_SERVER = 'http://34.197.47.192:3008/notify'

export const notifyUtils = {

    notify(msg: string) {
        const {webHookEnabled=false} = storeUtils.getUserInfo();

        if (webHookEnabled) {
            const network = APP_ENV.CL_APP_ENV;
            msg = `${APP_ENV.CL_EXTERNAL_IP} - ${msg}`;
            // post using fetch
            fetch(NOTIFY_SERVER, {
                body: JSON.stringify({
                    msg,
                    network
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
                method: 'POST'
            }).catch(() => '');
        }
    }
};