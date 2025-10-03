import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "./shell-service.js";

const INSTALL_PATH = '/etc/systemd/system/';

export const systemdService = {

    async install() {
        const {platform} = configStore.getSystemInfo();
        if (platform !== 'linux') {
            clm.warn('Node Pilot services can only be installed on Linux systems. Skipping systemd service installation.\n');
            return;
        }

        const projectFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../scripts/services`);

        if (!fs.existsSync(projectFolder)) {
            clm.error(`Node Pilot services's folder not found: ${projectFolder}`);
        }

        const restarterPath = path.join(INSTALL_PATH, 'node-pilot-restarter.service');
        const updaterPath = path.join(INSTALL_PATH, 'node-pilot-updater.service');

        let restarterInstalled = false;
        let updaterInstalled = false;

        if (!fs.existsSync(restarterPath)) {
            fs.cpSync(path.join(projectFolder, 'node-pilot-restarter.service'), path.join(INSTALL_PATH, 'node-pilot-restarter.service'));
            clm.step('Node Pilot restarter service installed successfully.');
            restarterInstalled = true;
        }

        if(!fs.existsSync(updaterPath)) {
            fs.cpSync(path.join(projectFolder, 'node-pilot-updater.service'), path.join(INSTALL_PATH, 'node-pilot-updater.service'));
            clm.step('Node Pilot updater service installed successfully.');
            updaterInstalled = true;
        }

        if (restarterInstalled || updaterInstalled) {
            await shellService.runCommand('systemctl daemon-reload');
        }

        if(restarterInstalled) {
            await shellService.runCommand('systemctl enable node-pilot-restarter.service');
            clm.step('Node Pilot restarter service enabled successfully.');
        }

        if(updaterInstalled) {
            await shellService.runCommand('systemctl enable node-pilot-updater.service');
            clm.step('Node Pilot updater service enabled successfully.');
        }
    }
}