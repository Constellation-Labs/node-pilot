import chalk from "chalk";
import * as fs from "node:fs";
import path from "node:path";

import {APP_ENV} from "./app-env.js";

export const logger = {
    debug (msg: string) {
        if(process.env.DEBUG === 'true') {
            console.log('[debug]', msg);
        }
    },

    error (msg: string) {
        console.error(chalk.red(msg));
    },

    fatal(msg: string) {
        const currentDateTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        msg = `[${currentDateTime}] ${msg}`;
        fs.appendFileSync(path.join(APP_ENV.PATH_LOGS, 'health-check-fatal.logs'), msg + '\n');
    },

    log(msg: string) {
        console.log(msg);
    },

    warn(msg: string) {
        console.warn(chalk.yellow(msg));
    },
}