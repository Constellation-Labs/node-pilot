import fs from "node:fs";
import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {CHUNK_SIZE} from "../types.js";
import {clusterUtils} from "./cluster-utils.js";
import {shellUtils} from "./shell-utils.js";
import {storeUtils} from "./store-utils.js";

export const healUtils = {

    async detectCorruptSnapshotsFromLogs() {

        const {dir=APP_ENV.PATH_LOGS} = storeUtils.getBackupInfo();
        logger.log(`detectCorruptSnapshots from ${dir}`);
        const dataDir = path.join(dir, 'app.log');
        const result = await shellUtils.runCommandWithOutput(`grep -o -E 'StateProof Broken at ordinal SnapshotOrdinal\\([0-9]+\\)' app.log | awk -F'[()]' '{print $2}' ${dataDir}`).catch(() => '');
        let oldestOrdinal = Number.MAX_SAFE_INTEGER;
        for (const number of result.split('\n')) {
            if (number) {
                oldestOrdinal = Math.min(oldestOrdinal, Number(number[0]));
            }
        }

        return oldestOrdinal === Number.MAX_SAFE_INTEGER ? 0 :  oldestOrdinal;
    },

    async detectSeedlistDoesNotMatch() {
        if (APP_ENV.CL_APP_ENV === 'mainnet') return;

        const {dir=APP_ENV.PATH_LOGS} = storeUtils.getBackupInfo();
        logger.log(`detectSeedlistDoesNotMatch from ${dir}`);
        const dataDir = path.join(dir, 'app.log');
        const result = await shellUtils.runCommandWithOutput(`grep -i 'SeedlistDoesNotMatch' ${dataDir}`).catch(() => '');

        if (result) {
            const url = `https://constellationlabs-dag.s3.us-west-1.amazonaws.com/${APP_ENV.CL_APP_ENV}-seedlist`;
            const content = await fetch(url).then(res => res.text());
            const seedFile = path.resolve('/app', 'seedlist');
            if (fs.existsSync(seedFile)) {
                fs.writeFileSync(seedFile, content);
                storeUtils.setNodeStatusInfo({error: 'node:invalid-seedlist'});
                storeUtils.setTimerInfo({fatal:false}); // reset fatal flag
                throw new Error('RESTART_REQUIRED');
            }
        }

        return false;
    },

    async getOldestMissingOrdinalFromLogs() {

        const {dir=APP_ENV.PATH_LOGS} = storeUtils.getBackupInfo();
        logger.log(`getOldestMissingOrdinal from ${dir}`);
        const dataDir = path.join(dir, 'app.log');
        const result = await shellUtils.runCommandWithOutput(`grep -i 'Global snapshot not found for ordinal' ${dataDir}`).catch(() => '');
        let oldestOrdinal = Number.MAX_SAFE_INTEGER;
        for (const line of result.split('\n')) {
            const number = line.match(/\d+/);
            if (number) {
                oldestOrdinal = Math.min(oldestOrdinal, Number(number[0]));
            }
        }

        return oldestOrdinal === Number.MAX_SAFE_INTEGER ? 0 :  oldestOrdinal;
    },

    async removeSnapshotsAfterCorruptOrdinal(ordinal: number) {
        const clusterOrdinal = await clusterUtils.getSourceNodeLatestOrdinal();
        // Only remove snapshots from latest archive chunk
        logger.log(`Checking for reasonable distance between ${clusterOrdinal} - ${ordinal}:  ${clusterOrdinal - ordinal} < 10_000`);
        if (clusterOrdinal - ordinal > 10_000) {
            const chunk = Math.floor(Number(ordinal) / CHUNK_SIZE) * CHUNK_SIZE;
            const parentDir = path.join(APP_ENV.PATH_DATA, 'incremental_snapshot', 'ordinal');
            const dataDir = path.join(parentDir, chunk.toString());
            if (!fs.existsSync(dataDir)) {
                logger.log(`Folder ${chunk} does not exist. Skipping snapshot cleanup.`);
                return;
            }

            logger.log(`Removing snapshots from folder ${chunk}...`);
            const files = fs.readdirSync(dataDir).sort();
            if (files.length === 0) {
                logger.log(`No snapshots found. ${files.length} found in ${dataDir}`);
                return;
            }

            let i = files.indexOf(ordinal.toString());
            if (i === -1) {
                if (Number(files[0]) > ordinal) {
                    if (fs.readdirSync(parentDir).length === 1) {
                        logger.log(`Not enough snapshots to clean. Waiting for next Starchiver retrieval cycle.'`);
                        return;
                    }

                    i = 0;
                }
                else {
                    while (i < files.length && Number(files[i]) < ordinal) { i++; }
                }
            }

            for (let j = i; j < files.length; j++) {
                fs.rmSync(path.join(dataDir, files[j]));
            }

            const total = files.length - i + 1;
            if (total > 0) {
                logger.log(`Removed snapshots starting from ${files[i]}, total removed ${total})`);
            }
            else {
                logger.log(`No snapshots to remove from set ${files[0]} to ${files.at(-1)}`);
            }
        }
        else {
            logger.log('Missing snapshot is too far behind. Waiting for next Starchiver retrieval cycle.');
        }
    }
}