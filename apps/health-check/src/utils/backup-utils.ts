import * as fs from "node:fs";
import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {storeUtils} from "./store-utils.js";

export const backupUtils = {

    backupLogs() {
        const logsDir = APP_ENV.PATH_LOGS;
        const backupDir = `${APP_ENV.PATH_LOGS}/autoheal-restarts/${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;

        if (fs.existsSync(backupDir)) return;

        this.cleanLogs();

        fs.mkdirSync(backupDir, { recursive: true });

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
    },

    // Remove all subdirectories but the last two created
    cleanLogs() {
        const backupDir = `${APP_ENV.PATH_LOGS}/autoheal-restarts`;

        if (!fs.existsSync(backupDir)) return;

        const subDirs = fs.readdirSync(backupDir);

        if (subDirs.length <= 1) return;

        logger.log(`Cleaning logs in ${backupDir}. Found ${subDirs.length} subdirectories`);

        const sortedSubDirs = subDirs
            .map(name => path.join(backupDir, name))
            .filter(p => fs.statSync(p).isDirectory())
            .sort((a, b) => fs.statSync(a).ctimeMs - fs.statSync(b).ctimeMs);

        const toDelete = sortedSubDirs.slice(0, -1);
        for (const dir of toDelete) {
            logger.log(`Deleting ${dir}`);
            fs.rmSync(dir, {force: true, recursive: true});
        }
    }
};