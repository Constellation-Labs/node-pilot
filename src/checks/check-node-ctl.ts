import {input, password} from "@inquirer/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {shellService} from "../services/shell-service.js";

export const checkNodeCtl = {

    async check4Migration() {

        if(configStore.hasProjectFlag('nodeCtlChecked')) {
            return;
        }

        const { name } = configStore.getProjectInfo();

        if (name.toLowerCase() !== 'hypergraph') {
            configStore.setProjectFlag('nodeCtlChecked', true);
            return;
        }

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

        configStore.setProjectFlag('nodeCtlChecked', true);
    },

    async importKeyInfo(cnPath: string) {

        clm.step('Importing key file from nodectl...');

        try {
            const doc = yaml.parse(fs.readFileSync(cnPath, 'utf8')) as CN_YAML;

            // console.log(JSON.stringify(doc,null,2));

            // eslint-disable-next-line camelcase
            const {key_location, key_name} = doc.nodectl.global_p12;
            const nodeCtlKeyPath = path.resolve(key_location, key_name);

            clm.debug(`Found key file path in nodectl config file: ${nodeCtlKeyPath}`);

            clm.step('Key file found at ' + chalk.cyan(nodeCtlKeyPath));
            clm.preStep('Importing key file...');

            const {projectDir} = configStore.getProjectInfo();
            const pilotKeyPath = path.join(projectDir, 'key.p12');

            // copy file to home directory, change owner to current user, and make it readable by all
            await shellService.runCommand(`sudo cp ${nodeCtlKeyPath} ${pilotKeyPath}; sudo chown $(whoami) ${pilotKeyPath}; chmod +r ${pilotKeyPath}`);

            await this.promptForKeyFile(pilotKeyPath);


        } catch (error) {
            console.error(error);
            clm.warn('Failed to import key information from nodectl. You will need to import it manually.');
            await promptHelper.doYouWishToContinue();
        }

    },

    async promptForKeyFile(pilotKeyPath: string) {

        // prompt for password
        const keyPassword = await password({message: 'Enter the key file password:'});
        const keyAlias = await input({message: 'Enter the key file alias:'});

        configStore.setEnvCommonInfo({CL_KEYALIAS: keyAlias, CL_KEYSTORE: pilotKeyPath, CL_PASSWORD: keyPassword});

        try {
            const dagAddress = await keyFileHelper.getAddress();
            const nodeId = await keyFileHelper.getId();
            configStore.setProjectInfo({dagAddress, nodeId});

        } catch {
            clm.warn('Failed to unlock the key file. Please check your key file information and try again.');
            fs.rmSync(pilotKeyPath);
            await this.promptForKeyFile(pilotKeyPath);
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