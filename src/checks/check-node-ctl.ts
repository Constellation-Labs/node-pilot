import {input, password} from "@inquirer/prompts";
import chalk from "chalk";
import {load as yamlLoad} from "js-yaml";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {shellService} from "../services/shell-service.js";

export const checkNodeCtl = {

    async check4Migration() {

        const isDockerRunning = await dockerHelper.isRunning();
        const isPortOpen = await dockerHelper.isPortInUse(9000);
        const hasNodeAdminUser = fs.existsSync('/home/nodeadmin');

        if (hasNodeAdminUser) {
            clm.step('nodectl has been detected.');

            if (!isDockerRunning && isPortOpen) {
                clm.error('Please shutdown any Nodes being managed by nodectl before proceeding.');
            }

            const cnPath = path.resolve('/var/tessellation/nodectl/cn-config.yaml');

            if (fs.existsSync(cnPath)) {

                const answer = await input({
                    default: 'y',
                    message: 'Would you like to import key file from nodectl? (y/n): '
                })
                if (answer.toLowerCase() === 'y') {
                    await this.importKeyInfo(cnPath);
                }
            }
        }

    },

    async importKeyInfo(cnPath: string) {

        clm.step('Importing key file from nodectl...');
        const doc = yamlLoad(fs.readFileSync(cnPath, 'utf8')) as CN_YAML;

        try {
            // eslint-disable-next-line camelcase
            const {key_location, key_name} = doc.nodectl.global_p12;
            const keyPath = path.resolve(key_location, key_name);

            if (fs.existsSync(keyPath)) {

                clm.step('Key file found at ' + chalk.cyan(keyPath));
                clm.preStep('Importing key file...');

                const {projectDir} = configStore.getProjectInfo();
                const pilotKeyPath = path.join(projectDir, 'key.p12');

                // copy file to home directory, change owner to current user, and make it readable by all
                await shellService.runCommand(`sudo cp ${keyPath} ${pilotKeyPath}; sudo chown $(whoami) ${pilotKeyPath}; chmod +r ${pilotKeyPath}`);

                // change owner of file to current user
                // await shellService.runCommand(`sudo chown $(whoami) ${pilotKeyPath}; chmod +r ${pilotKeyPath}`);



                await this.promptForKeyFile();
            }

        } catch {
            clm.error('Failed to import key information from nodectl. You will need to import it manually.');
        }
    },

    async promptForKeyFile() {
        const {projectDir} = configStore.getProjectInfo();
        const keyStorePath = path.join(projectDir, "key.p12");

        // prompt for password
        const keyPassword = await password({message: 'Enter the key file password:'});
        const keyAlias = await input({message: 'Enter the key file alias:'});

        configStore.setEnvCommonInfo({CL_KEYALIAS: keyAlias, CL_KEYSTORE: keyStorePath, CL_PASSWORD: keyPassword});

        try {
            const dagAddress = await keyFileHelper.getAddress();
            const nodeId = await keyFileHelper.getId();
            configStore.setProjectInfo({dagAddress, nodeId});

        } catch {
            clm.warn('Failed to unlock the key file. Please check your key file information and try again.');
            fs.rmSync(keyStorePath);
            await this.promptForKeyFile();
            return;
        }

        clm.postStep('Key file imported successfully.\n');
    }
}

type CN_YAML = {
    nodectl: {
        global_p12: {
            encryption: string;
            key_location: string;
            key_name: string;
            passphrase: string;
        }
    }
}