import * as fs from "node:fs";
import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {storeUtils} from "./store-utils.js";

export const backupUtils = {

    backupLogs() {
        const logsDir = APP_ENV.PATH_LOGS;
        const backupDir = `${APP_ENV.PATH_LOGS}/autoheal-restarts/${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const files = fs.readdirSync(logsDir).filter((file: string) => file !== 'autoheal-restarts' && !file.startsWith('health-check-fatal') && !file.startsWith('hydrate'));
        for (const file1 of files) {
            const src = path.join(logsDir, file1);
            const dest = path.join(backupDir, file1);
            if (fs.statSync(src).isDirectory()) {
                fs.cpSync(src, dest, { recursive: true });
            } else {
                fs.copyFileSync(src, dest);
            }

            fs.rmSync(src, { force: true, recursive: true });
        }

        storeUtils.setBackupInfo({ date: new Date().toISOString(), dir: backupDir })
    }
};