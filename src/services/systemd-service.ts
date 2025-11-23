import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {clm} from "../clm.js";
import {shellService} from "./shell-service.js";

export const systemdService = {

    async install() {
        const platform = os.platform();
        if (platform !== 'linux') {
            clm.warn('systemd services can only be installed on Linux systems. Skipping...\n');
            return;
        }

        const scriptFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../scripts/install_services.sh`);

        if (!fs.existsSync(scriptFile)) {
            clm.error(`Node Pilot install system services script not found: ${scriptFile}`);
        }

        clm.preStep('Installing Node Pilot system services...');

        await shellService.runCommand(scriptFile);

        clm.postStep('\nNode Pilot system service started successfully.');
    },

    async uninstall() {
        const platform = os.platform();
        if (platform !== 'linux') {
            clm.warn('systemd services can only be installed on Linux systems. Skipping...\n');
        }

        const scriptFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../scripts/uninstall_services.sh`);

        if (!fs.existsSync(scriptFile)) {
            clm.error(`Node Pilot uninstall system services script not found: ${scriptFile}`);
        }

        clm.preStep('Uninstalling Node Pilot system services...');

        await shellService.runCommand(scriptFile);

        clm.postStep('\nNode Pilot system service uninstalled successfully.');
    }
}