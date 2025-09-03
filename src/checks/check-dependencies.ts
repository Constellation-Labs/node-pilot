import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import shell from "shelljs";

import {clm} from "../clm.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {shellService} from "../services/shell-service.js";

export const checkDependencies = async () => {

    const isDockerV1Installed = await shellService.checkCommandAvailable('docker-compose');

    if (isDockerV1Installed) {
        clm.error('You are using docker-compose v1. It will be uninstalled before upgrading to the latest version.'); // Please uninstall using: ${chalk.cyan('sudo apt-get remove docker-compose-plugin')}. Afterwards, run cpilot again`);
        await promptHelper.doYouWishToContinue();
        await shellService.runCommand('for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done');
    }

    const isDockerInstalled = await shellService.checkCommandAvailable('docker');

    if (!isDockerInstalled) {
        const pilotDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../..`);
        if (fs.existsSync(path.join(pilotDir, 'install-dependencies.sh'))) {

            // Skip prompt if already informed user of the upgrade
            if (!isDockerV1Installed) {
                clm.step('Docker is required and needs to be installed.');
                await promptHelper.doYouWishToContinue();
            }

            clm.debug(`Running install-dependencies.sh from ${pilotDir}`);

            const result = shell.exec('install-dependencies.sh', { cwd: pilotDir });

            if (result.code > 0) {
                clm.error(`Failed to install dependencies. Please try again after resolving any errors.`);
            }

            clm.postStep(`Docker has been installed. Please logout and login again to ensure the changes take effect. Then run cpilot again.`);
            process.exit(0);
        }
    }

}