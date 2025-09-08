import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import shell from "shelljs";

import {clm} from "../clm.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {shellService} from "../services/shell-service.js";

export const checkDependencies = async () => {

    const dockerComposeVersion = await shellService.runCommand('docker compose version').catch(() => '');

    clm.debug(`Docker compose version check: ${dockerComposeVersion || 'NOT_INSTALLED'}`);

    if (dockerComposeVersion) {
        return;
    }

    const isDockerV1Installed = await shellService.checkCommandAvailable('docker-compose');

    if (isDockerV1Installed) {
        clm.warn('You are using docker-compose v1. It needs to be uninstalled before upgrading to the latest version.');
        // await promptHelper.doYouWishToContinue();
        clm.step('\nRun the following command to uninstall docker-compose v1 and then run cpilot again:')
        clm.preStep('for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done');
        clm.echo('')
        process.exit(0);
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

            const silent = !process.env.DEBUG;

            const result = shell.exec('bash install-dependencies.sh', { cwd: pilotDir, silent });

            if (result.code > 0) {
                console.log(result.stderr);
                clm.error(`Failed to install dependencies. Please try again after resolving any errors.`);
            }

            clm.postStep(`\nDocker has been installed. Please logout and login again to ensure the changes take effect. Then run cpilot again.`);
            clm.echo('');
            process.exit(0);
        }
    }

}

