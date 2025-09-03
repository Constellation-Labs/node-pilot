import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import shell from "shelljs";

import {clm} from "../clm.js";
import {promptHelper} from "../helpers/prompt-helper.js";

export const checkDependencies = async () => {

    const dockerComposeVersion = await runCommand('docker compose version').catch(() => '');

    clm.debug(`Docker compose version check: ${dockerComposeVersion || 'NOT_INSTALLED'}`);

    if (dockerComposeVersion) {
        return;
    }

    const isDockerV1Installed = await checkCommandAvailable('docker-compose');

    if (isDockerV1Installed) {
        clm.error('You are using docker-compose v1. It will be uninstalled before upgrading to the latest version.');
        await promptHelper.doYouWishToContinue();
        await runCommand('for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done');
    }

    const isDockerInstalled = await checkCommandAvailable('docker');

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

async function checkCommandAvailable(cmd: string) {
    clm.debug(`Checking if command ${cmd} is available...`);
    return runCommand(`command -v ${cmd}`)
        .then(() =>  true)
        .catch((error) => {
            clm.debug(`Run command error: ${error}`);
            return false;
        });
}

async function runCommand (command: string) {

    clm.debug(`START Running command: "${command}`);

    const result = shell.exec(command);

    clm.debug(`END ${command}. Exit code: ${result.code}`);

    if (result.code > 0) {
        throw new Error(`Failed running command: ${result.stderr}`);
    }

    return result;
}