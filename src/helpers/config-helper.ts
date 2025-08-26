import chalk from "chalk";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";

export const configHelper = {

    assertProject(prefix = '') {
        if (configStore.hasProjects()) return;
        clm.error(prefix + 'Please create a new project first.');
    },

    async getReleaseInfo() {
        const { projectDir } = configStore.getProjectInfo();

        const lastInstallVersion = path.resolve(projectDir, "dist/version.sh");
        if (!fs.existsSync(lastInstallVersion)) {
            return;
        }

        const versionObj = this.parseEnvFile(lastInstallVersion);

        return {
            network: versionObj.RELEASE_NETWORK_TYPE,
            version: versionObj.RELEASE_NETWORK_VERSION
        }
    },

    parseEnvFile(filePath: string) {
        const fileStr = fs.readFileSync(filePath, 'utf8');
        return dotenv.parse(fileStr);
    },

    showEnvInfo(name: string, value: string) {
        console.log(`${chalk.white(name)}=${chalk.cyan(value)}`);
    },

    showEnvInfoList(list: {name: string, value: string}[]) {
        const formatted = list.map(i => {
            const value = (i.name === 'CL_PASSWORD') ? '************' : i.value;
            return `${chalk.white(i.name)}=${chalk.cyan(value || '')}`;
        }).join('\n');

        console.log(formatted);
    }
}