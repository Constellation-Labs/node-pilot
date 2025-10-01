import shell from "shelljs";

import {logger} from "../logger.js";

export const shellUtils = {
    async runCommand (command: string, silent = false) {

        logger.debug(`START Running command: "${command}"`);

        const result = shell.exec(command, { silent });

        logger.debug(`END ${command}. Exit code: ${result.code}`);

        if (result.code > 0) {
            throw new Error(`Failed running command: ${command} with ERROR: ${result.stderr}`);
        }

        return result;
    },

    async runCommandWithOutput(command: string) {
        const result = await this.runCommand(command, true);

        return result.stdout.trim();
    },
}