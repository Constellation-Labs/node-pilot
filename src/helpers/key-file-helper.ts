import {input, password,select} from "@inquirer/prompts";
import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "../services/shell-service.js";
import {configHelper} from "./config-helper.js";
import {getObjectToEnvContent} from "./env-templates.js";

export const keyFileHelper = {

    async changePassword(newPassword: string) {
        const { projectDir } = configStore.getProjectInfo();
        const keyFilePath = path.join(projectDir, "key.p12");
        if (!fs.existsSync(keyFilePath)) {
            clm.error('No key file found. Please generate a new key file first.');
        }

        const {CL_PASSWORD: currentPassword} = configStore.getEnvInfo();
        if (currentPassword === newPassword) {
            clm.error('The new password is the same as the current password. Please try again with a different password.');
        }

        await shellService.runCommand(`keytool -importkeystore -srckeystore ${keyFilePath} -srcstoretype PKCS12 -srcstorepass '${currentPassword}' -destkeystore ${path.join(projectDir, "temp.p12")} -deststoretype PKCS12 -deststorepass '${newPassword}' -destkeypass '${newPassword}'`);

        await this.promptSaveBackup({CL_KEYALIAS: 'alias', CL_KEYSTORE: keyFilePath, CL_PASSWORD: newPassword});
    },

    async generate() {
        const { projectDir } = configStore.getProjectInfo();
        const keyFilePath = path.join(projectDir, "key.p12");
        let modifier = '';
        if (fs.existsSync(keyFilePath)) {
            modifier = 'new '
            const answer = await input({default: 'n', message: 'A key file already exists. Do you want to overwrite it? (y/n): '});
            if (answer.toLowerCase() === 'y') {
                fs.rmSync(keyFilePath, { force: true } );
            }
            else {
                clm.echo('Key file generation cancelled.');
                process.exit(0);
            }
        }

        const keyPassword = await password({ message: `Enter the ${modifier}key file password:`, validate: value => value.length > 0});
        const env = {
            CL_KEYALIAS: "alias", CL_KEYSTORE: keyFilePath, CL_PASSWORD: keyPassword
        }
        await shellService.runCommand(`java -jar ${projectDir}/dist/keytool.jar generate`, env);
        configStore.setEnvInfo(env);

        const dagAddress = await this.getAddress();
        const nodeId = await this.getId();
        configStore.setProjectInfo({dagAddress, nodeId});

        clm.postStep('Key file generated successfully.\n');

       await this.promptSaveBackup(env);
    },

    async getAddress() {
        const { projectDir } = configStore.getProjectInfo();
        const env= configStore.getEnvInfo();
        return shellService.runCommandWithOutput(`java -jar ${projectDir}/dist/wallet.jar show-address`, env);
    },

    async getId() {
        const { projectDir } = configStore.getProjectInfo();
        const env= configStore.getEnvInfo();
        return shellService.runCommandWithOutput(`java -jar ${projectDir}/dist/wallet.jar show-id`, env);
    },

    async importKeyFile() {
        const p12Files = fs.readdirSync(os.homedir())
            .filter(file => file.endsWith('.p12'))
            .map(file => ({ name: 'Import ~/' + file, value: file }));

        let userKeyPath = '';
        let answer = 'importAnother';

        if (p12Files.length > 0) {

            const choices = [
                ...p12Files,
                {name: 'Import a different key file', value: 'importAnother'}
            ];
            answer = await select({choices, message: 'Choose an option:'});

            userKeyPath = path.join(os.homedir(), answer);
        }

        if (answer === 'importAnother') {
            userKeyPath = await input({
                message: 'Enter the path to your key file:',
                validate(value) {
                    const fullPath = shellService.resolvePath(value.trim());
                    if (!fs.existsSync(fullPath)) {
                        return `${fullPath} does not exist. Please provide a valid path.`;
                    }

                    return true;
                }
            });
        }

        const { projectDir } = configStore.getProjectInfo();
        const fullPath = shellService.resolvePath(userKeyPath.trim());
        const keyStorePath = path.join(projectDir, "key.p12");
        const tempKeyPath = path.join(projectDir, "temp.p12");
        const envInfo = configStore.getEnvInfo();

        // prompt for password
        const keyPassword = await password({ message: 'Enter the key file password:'});
        const keyAlias = await input({message: 'Enter the key file alias:'});

        configStore.setEnvInfo({CL_KEYALIAS: keyAlias, CL_KEYSTORE: keyStorePath, CL_PASSWORD: keyPassword});

        try {
            if (fs.existsSync(keyStorePath)) fs.cpSync(keyStorePath, tempKeyPath, { force: true });
            fs.copyFileSync(fullPath, keyStorePath);
        } catch (error) {
            clm.error('Failed to import key file:' + error);
        }

        try {
            const dagAddress = await this.getAddress();
            const nodeId = await this.getId();
            configStore.setProjectInfo({dagAddress, nodeId});

        }
        catch {

            if (fs.existsSync(tempKeyPath)) {
                // Revert back to original key file
                fs.cpSync(tempKeyPath, keyStorePath, { force: true });
                configStore.setEnvInfo({CL_KEYALIAS: envInfo.CL_KEYALIAS, CL_KEYSTORE: envInfo.CL_KEYSTORE, CL_PASSWORD: envInfo.CL_PASSWORD});
            }
            else {
                fs.rmSync(keyStorePath);
            }

            clm.error('Failed to unlock the key file. Please check your key file information and try again.');
            // await this.promptForKeyFile();
            // return;
        }

        try {
            fs.copyFileSync(fullPath, keyStorePath);
        } catch (error) {
            clm.error('Failed to import key file:' + error);
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

        configStore.setProjectFlag('duplicateNodeIdChecked', false);
        configStore.setProjectFlag('seedListChecked', false);
    },

    async promptIfNoKeyFile() {
        const { projectDir } = configStore.getProjectInfo();

        const keyFilePath = path.join(projectDir, "key.p12");
        if (fs.existsSync(keyFilePath)) {
            return;
        }

        await this.promptForKeyFile();
    },

    async promptSaveBackup(env: object) {
        const { projectDir } = configStore.getProjectInfo();
        const keyFilePath = path.join(projectDir, "key.p12");
        const {dagAddress, nodeId} = configStore.getProjectInfo();
        const answer = await input({default: 'y', message: 'Would you like to save a backup of the key file to your home directory? (y/n): '});
        if (answer.toLowerCase() === 'y') {
            const homeKeyPath = path.join(os.homedir(), 'key.p12');
            const homeKeyInfoPath = path.join(os.homedir(), 'key-info');
            if (fs.existsSync(homeKeyPath)) {
                const backupUniqueName = new Date().toISOString().replaceAll(':', '-');
                const backupKeyName = `key-${backupUniqueName}.p12`;
                const backupKeyPath = path.join(os.homedir(), backupKeyName);
                fs.renameSync(homeKeyPath, backupKeyPath);
                clm.postStep(`An existing key file was found in your home directory and has been renamed to ${chalk.cyan(backupKeyName)}`);
                if (fs.existsSync(homeKeyInfoPath)) {
                    fs.renameSync(homeKeyInfoPath, path.join(os.homedir(), `key-info-${backupUniqueName}`));
                }
            }

            fs.cpSync(keyFilePath, homeKeyPath);
            fs.writeFileSync(path.join(os.homedir(), 'key-info'), getObjectToEnvContent({ ...env, CL_KEYSTORE: 'key.p12', CL_PASSWORD: '****', NODE_ADDRESS: dagAddress, NODE_ID: nodeId}));
            clm.postStep(`A copy of the Key file has been saved to your home directory - ${chalk.cyan(homeKeyPath)}`);
        }
    },

    async showKeyFileInfo(prompt4ShowPassword = true) {
        clm.preStep('Current key file information:');

        const { dagAddress, nodeId } = configStore.getProjectInfo();
        configHelper.showEnvInfo('Node ID', nodeId);
        configHelper.showEnvInfo('DAG Address', dagAddress);

        const {CL_KEYALIAS, CL_KEYSTORE, CL_PASSWORD} = configStore.getEnvInfo();
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