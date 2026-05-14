import fs from "node:fs";
import path from "node:path";

import {pilotManager} from "./pilot-manager.js";

export const serviceLog = {

    error(s: string) {
        this.log(s);
    },

    log(s: string) {
        const appDir = pilotManager.getAppDir();
        const logFile = path.join(appDir,'logs','service.log');

        fs.appendFileSync(logFile, s + '\n');
    },

    warn(s: string) {
        this.log(s);
    },
}