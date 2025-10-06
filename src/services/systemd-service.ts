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

        clm.preStep('Installing Node Pilot system services...');

        const restarterPath = path.join(INSTALL_PATH, 'node-pilot-restarter.service');
        const updaterPath = path.join(INSTALL_PATH, 'node-pilot-updater.service');

        let restarterInstalled = false;
        let updaterInstalled = false;

        if (!fs.existsSync(restarterPath)) {
            await shellService.runCommand(`sudo cp ${path.join(projectFolder, 'node-pilot-restarter.service')} ${restarterPath}`);
            clm.step('Node Pilot restarter service installed successfully.');
            restarterInstalled = true;
        }

        if(!fs.existsSync(updaterPath)) {
            await shellService.runCommand(`sudo cp ${path.join(projectFolder, 'node-pilot-updater.service')} ${updaterPath}`);
            clm.step('Node Pilot updater service installed successfully.');
            updaterInstalled = true;
        }

        if (restarterInstalled || updaterInstalled) {
            await shellService.runCommand('sudo systemctl daemon-reload');
        }

        await shellService.runCommand('sudo systemctl enable node-pilot-restarter.service');
        await shellService.runCommand('sudo systemctl start node-pilot-restarter.service');
        clm.postStep('\nNode Pilot restarter service started successfully.');

        await shellService.runCommand('sudo systemctl enable node-pilot-updater.service');
        await shellService.runCommand('sudo systemctl start node-pilot-updater.service');
        clm.postStep('\nNode Pilot updater service started successfully.');
    }
}