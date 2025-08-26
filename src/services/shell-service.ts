import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import shell from "shelljs";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";

export const shellService = {

    async checkCommandAvailable(cmd: string) {
        return this.runCommand(`command -v ${cmd}`, undefined, true)
            .then(() => true)
            .catch(() => false);
    },

    async execDockerShell(serviceName: string, command: string) {
        const { projectDir } = configStore.getProjectInfo();

        clm.debug(`Running command: docker compose exec ${serviceName} bash -c "${command}"`);

        const result = shell.exec(`docker compose exec ${serviceName} bash -c "${command}"`, { cwd: projectDir, silent: true });

        if (result.stderr && result.code > 0) {
            clm.error(`Command Failed - ${command} with stderr: ${result.stderr}`);
        }

        return result.stdout;
    },

    existsScript(filePath: string) {
        const { projectDir } = configStore.getProjectInfo();
        return fs.existsSync(path.join(projectDir, filePath));
    },

    resolvePath(keyPath: string) {
        if (keyPath.startsWith('~/')) {
            return path.join(os.homedir(), keyPath.slice(2));
        }

        if (keyPath.startsWith('/')) {
            return keyPath;
        }

        return path.resolve(process.cwd(), keyPath);
    },

    async runCommand (command: string, env?: object, silent = false) {

        const { projectDir } = configStore.getProjectInfo();

        let nodeEnv: NodeJS.ProcessEnv | undefined;

        if (env) {
            nodeEnv = { ...env, ...process.env };
        }

        clm.debug(`START Running command: "${command}" in directory: "${projectDir}"`);

        const result = shell.exec(command, { cwd: projectDir, env: nodeEnv, silent });

        clm.debug(`END ${command}. Exit code: ${result.code}`);

        if (result.code > 0) {
            throw new Error(`Failed running command: ${result.stderr}`);
        }

        return result;
    },

    async runCommandWithOutput(command: string, env?: object) {
        const result = await this.runCommand(command, env, true);

        return result.stdout.trim();
    }

}