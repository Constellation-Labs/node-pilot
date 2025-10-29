import chalk from "chalk";

import {configStore} from "./config-store.js";
import {serviceLog} from "./helpers/service-log.js";

/*
    Command Line Messaging with color styling
 */
export const clm = {
    debug (msg: string) {
        if(process.env.DEBUG === 'true') {
            console.log('[debug]', msg);
        }
    },

    echo(msg: string) {
        o().log(msg);
    },

    echoRepeatLine(char: string) {
        process.stdout.write('\r' + char);
    },

    error (msg: string, silent = true) {
        o().error(chalk.red(msg));
        process.exit(silent ? 0 : 1);
    },

    postStep(s: string) {
        o().log(chalk.green(s));
    },

    preStep(s: string) {
        o().log('\n' + chalk.italic(chalk.green(s)));
    },

    step(msg: string) {
        o().warn(chalk.whiteBright(msg));
    },

    warn(msg: string) {
        o().warn(chalk.yellow(msg));
    }
}

function o(): OutStream {
    return configStore.isRestarting() ? serviceLog : console
}

type OutStream = {
    error: (msg: string) => void;
    log: (msg: string) => void;
    warn: (msg: string) => void;
}