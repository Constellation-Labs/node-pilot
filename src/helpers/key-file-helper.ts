import {input, password,select} from "@inquirer/prompts";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "../services/shell-service.js";
import {configHelper} from "./config-helper.js";

export const keyFileHelper = {

    async generate() {
        const { projectDir } = configStore.getProjectInfo();
        const env = {
            CL_KEYALIAS: "alias", CL_KEYSTORE: path.join(projectDir, 'key.p12'), CL_PASSWORD: "password"
        }
        await shellService.runCommand(`java -jar ${projectDir}/dist/keytool.jar generate`, env);
        configStore.setEnvCommonInfo(env);

        const dagAddress = await this.getAddress();
        const nodeId = await this.getId();
        configStore.setProjectInfo({dagAddress, nodeId});
    },

    async getAddress() {
        const { projectDir } = configStore.getProjectInfo();
        const env= configStore.getEnvCommonInfo();
        return shellService.runCommandWithOutput(`java -jar ${projectDir}/dist/wallet.jar show-address`, env);
    },

    async getId() {
        const { projectDir } = configStore.getProjectInfo();
        const env= configStore.getEnvCommonInfo();
        return shellService.runCommandWithOutput(`java -jar ${projectDir}/dist/wallet.jar show-id`, env);
    },

    async importKeyFile() {
        const userKeyPath = await input({
            message: 'Enter the path to your key file:',
            validate(value) {
                const fullPath = shellService.resolvePath(value.trim());
                if (!fs.existsSync(fullPath)) {
                    return `${fullPath} does not exist. Please provide a valid path.`;
                }

                return true;
            }
        });

        const { projectDir } = configStore.getProjectInfo();
        const fullPath = shellService.resolvePath(userKeyPath.trim());
        const keyStorePath = path.join(projectDir, "key.p12");

        try {
            fs.copyFileSync(fullPath, keyStorePath);
        } catch (error) {
            clm.error('Failed to import key file:' + error);
        }

        // prompt for password
        const keyPassword = await password({ message: 'Enter the key file password:'});
        const keyAlias = await input({message: 'Enter the key file alias:'});

        configStore.setEnvCommonInfo({CL_KEYALIAS: keyAlias, CL_KEYSTORE: keyStorePath, CL_PASSWORD: keyPassword});

        try {
            const dagAddress = await this.getAddress();
            const nodeId = await this.getId();
            configStore.setProjectInfo({dagAddress, nodeId});

        }
        catch {
            clm.warn('Failed to unlock the key file. Please check your key file information and try again.');
            fs.rmSync(keyStorePath);
            await this.promptForKeyFile();
            return;
        }

        clm.postStep('Key file imported successfully.\n');

    },

    async promptForKeyFile() {

        const choices=  [
            {name: 'Generate a new key file', value: 'generate'},
            {name: 'Import an existing key file', value: 'import'}
        ];

        const { projectDir } = configStore.getProjectInfo();

        const keyFilePath = path.join(projectDir, "key.p12");
        if (fs.existsSync(keyFilePath)) {
            choices.push({name: 'Skip', value: 'skip'})
        }
        else {
            clm.preStep('A key file is required to run the node.');
        }

        const answer = await select({ choices, message: 'Choose an option:'});
        if (answer === 'generate') {
            await this.generate();
            await this.showKeyFileInfo();
        }
        else if (answer === 'import') {
            await this.importKeyFile();
            await this.showKeyFileInfo(false);
        }
    },

    async promptIfNoKeyFile() {
        const { projectDir } = configStore.getProjectInfo();

        const keyFilePath = path.join(projectDir, "key.p12");
        if (fs.existsSync(keyFilePath)) {
            return;
        }

        await this.promptForKeyFile();
    },

    async showKeyFileInfo(prompt4ShowPassword = true) {
        const { dagAddress, nodeId } = configStore.getProjectInfo();
        configHelper.showEnvInfo('Node ID', nodeId);
        configHelper.showEnvInfo('DAG Address', dagAddress);

        const {CL_KEYALIAS, CL_KEYSTORE, CL_PASSWORD} = configStore.getEnvCommonInfo();
        configHelper.showEnvInfo('CL_KEYSTORE', CL_KEYSTORE || '');
        configHelper.showEnvInfo('CL_KEYALIAS', CL_KEYALIAS || '');
        configHelper.showEnvInfo('CL_PASSWORD', '*********');

        if (prompt4ShowPassword) {
            const show = await input({default: 'n', message: 'Show the password for the key file (y/n):'});

            if (show === 'y') {
                configHelper.showEnvInfo('CL_PASSWORD', CL_PASSWORD || '');
            }
        }
    }
}