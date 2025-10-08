import fs from "node:fs";
import path from "node:path";

import {configStore} from "../config-store.js";

export const serviceLog = {

    log(s: string) {
        const appDir = configStore.getAppDir();
        const logFile = path.join(appDir,'logs','service.log');

        fs.appendFileSync(logFile, s + '\n');
    },
}