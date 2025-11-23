import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "../services/shell-service.js";
import {systemdService} from "../services/systemd-service.js";
import {checkDependencies} from "./check-dependencies.js";
import {checkHardware} from "./check-hardware.js";

export const checkInitialSetup = {

    async checkExistingUsers() {

        const {otherUsers} = await this.getExistingInstallations();

        if (otherUsers.length > 0) {
            clm.warn(`There are other users that have Node Pilot installed.\n    ${otherUsers.join('\n    ')}`);
            clm.warn('To uninstall for another user, login as the user and run "cpilot uninstall".');
            clm.error('Node Pilot can only be installed for one user at a time.\n');
        }
    },

    async firstTimeRun() {

        if(configStore.hasProjectFlag('firstTimeChecked')) {
            return;
        }

        await checkDependencies();
        await this.checkExistingUsers();

        if(configStore.getSystemInfo() === null) {
            await checkHardware.systemRequirements();
        }

        // console.log(chalk.whiteBright("\n ****************************************"));
        // console.log("          " + chalk.whiteBright("CONSTELLATION NETWORK") + "        ");
        // console.log("               " + chalk.whiteBright("NODE PILOT") + "              ");
        // console.log(chalk.whiteBright(" ****************************************"));

        await systemdService.install();

        configStore.setProjectFlag('firstTimeChecked', true);
    },

    async getExistingInstallations() {
        const platform = os.platform();
        const isLinux = platform === 'linux';
        const homeFolder = isLinux ? '/home' : '/Users';
        const currentUser = os.userInfo().username;

        if (!fs.existsSync(homeFolder)) {
            clm.warn(`Home folder path does not exist: ${homeFolder}`);
            return { currentUser, otherUsers: [] };
        }

        const userFolders = fs.readdirSync(homeFolder).filter(file => fs.lstatSync(path.join(homeFolder,file)).isDirectory());
        const usersWithPilot = [];
        for (const folder of userFolders) {
            const dirPath = path.join(homeFolder, folder, '.node-pilot');
            const prefix = isLinux ? 'sudo ' : '';
            // eslint-disable-next-line no-await-in-loop
            const exists = await shellService.runCommandWithOutput(`${prefix}test -d "${dirPath}" && echo 1 || echo 0`);
            if (exists === '1') usersWithPilot.push(folder);
        }

        let rootUserHasPilot = false;

        if(isLinux) {
            const dirPath = path.join('/root', '.node-pilot');
            const exists = await shellService.runCommandWithOutput(`sudo test -d "${dirPath}" && echo 1 || echo 0`);
            if (exists === '1') {
                usersWithPilot.push('root');
                rootUserHasPilot = true;
            }
        }

        // console.log(`Current currentUser: ${currentUser}`);
        // console.log(`Users with Node Pilot installed: ${usersWithPilot.join(', ')}`);
        // console.log(`Root currentUser has Node Pilot installed: ${rootUserHasPilot}`);

        return { currentUser, otherUsers: usersWithPilot.filter(u => u !== currentUser), rootUserHasPilot};
    }

};
