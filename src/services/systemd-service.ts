import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "./shell-service.js";

export const systemdService = {

    async install() {
        const {platform} = configStore.getSystemInfo();
        if (platform !== 'linux') {
            clm.warn('Node Pilot services can only be installed on Linux systems. Skipping systemd service installation.\n');
            return;
        }

        const installServicesScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../scripts/install_services.sh`);

        if (!fs.existsSync(installServicesScript)) {
            clm.error(`Node Pilot install system services script not found: ${installServicesScript}`);
        }

        clm.preStep('Installing Node Pilot system services...');

        await shellService.runCommand(installServicesScript);

        clm.postStep('\nNode Pilot system service started successfully.');
    }
}