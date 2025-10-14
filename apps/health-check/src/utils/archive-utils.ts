
import chalk from "chalk";
import * as fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {clusterUtils} from "./cluster-utils.js";
import {FastforwardUtil} from "./fastforward-util.js";
import {healUtils} from "./heal-utils.js";
import {shellUtils} from "./shell-utils.js";
import {storeUtils} from "./store-utils.js";

// http://5.161.243.241:7777/hash.txt
const remoteIndexMap = {
    integrationnet: "http://5.161.243.241:7777",
    mainnet:  "http://128.140.33.142:7777",
    testnet: "http://65.108.87.84:7777"
}

type ArchiveInfo = { endOrdinal: number; startOrdinal: number, url: string };

export const archiveUtils = {

    async checkForCorruptAndMissingSnapshots() {

        storeUtils.setArchiveInfo({ isRunning: true, startTime: Date.now() });

        logger.log(`[${new Date().toISOString()}] Checking for corrupt snapshots...`);

        let ordinal = await healUtils.detectCorruptSnapshotsFromLogs();
        if (ordinal > 0) {
            logger.log('Corrupt snapshot detected at ordinal: ' + ordinal);
            // Remove corrupt snapshots from archive. Fallback to fast-forward strategy.
            await healUtils.removeSnapshotsAfterCorruptOrdinal(ordinal).catch();
            await FastforwardUtil.synctoLatestSnapshot();
            return;
        }

        ordinal = await healUtils.getOldestMissingOrdinalFromLogs(); // 4_064_489; //
        if (ordinal === 0) {
            logger.log('No snapshots found.');
            return;
        }

        logger.log('Oldest missing snapshot ordinal: ' + ordinal);

        try {
            const archiveInfo = await this.getArchiveListFromLatestToOrdinal(ordinal);
            if (archiveInfo.archives.length === 0) {
                logger.log('No archive is available.');
                return;
            }

            logger.log(`Found ${archiveInfo.archives.length} archives to download.`);

            for (const a of archiveInfo.archives) {
                // eslint-disable-next-line no-await-in-loop
                await downloadAndExtractArchive(a);
            }

            // await this.verifyArchiveSnapshotHash(archiveInfo.newestOrdinal);
        }
        catch {
            logger.error('Error downloading archive.')
            // Archive is not available. Remove corrupt snapshots from archive. Fallback to fast-forward strategy.
            await healUtils.removeSnapshotsAfterCorruptOrdinal(ordinal).catch();
            await FastforwardUtil.synctoLatestSnapshot();
        }
    },

    async getArchiveListFromLatestToOrdinal(ordinal: number) {
        const type = APP_ENV.CL_APP_ENV;
        const clusterOrdinal = await clusterUtils.getSourceNodeLatestOrdinal();
        const host = remoteIndexMap[type as keyof typeof remoteIndexMap];
        return fetch(host + '/hash.txt')
            .then(res => res.text())
            .then(txt => {
                const lines = txt.trim().split('\n');
                const archives: ArchiveInfo[] = [];
                let oldestOrdinal = Number.MAX_SAFE_INTEGER;
                let newestOrdinal = 0;
                for (const line of lines.reverse()) {
                    const filename = line.split(' ')[1];
                    const parseName = filename.split('.')[0].split('-');
                    const startOrdinal = Number(parseName.at(1)?.slice(1));
                    const endOrdinal = parseName.length < 4 ? startOrdinal + 20_000 - 1 : Number(parseName.at(3)?.slice(1));
                    oldestOrdinal = Math.min(oldestOrdinal, startOrdinal);
                    newestOrdinal = Math.max(newestOrdinal, endOrdinal);
                    logger.log(`Cluster: ${clusterOrdinal}, oldest: ${oldestOrdinal}, newest: ${newestOrdinal}, start: ${startOrdinal}, end: ${endOrdinal}, filename: ${filename}`);
                    if (endOrdinal < ordinal) {
                        logger.log(`endOrdinal < ordinal, ${endOrdinal} < ${ordinal}, skipping...`);
                        break;
                    }

                    if (this.hasDownloadedRange(startOrdinal.toString(), endOrdinal.toString())) {
                        logger.log('Skipping already downloaded archive: ' + filename);
                    }
                    else {
                        logger.log('Adding archive to download: ' + filename);
                        archives.push({ endOrdinal, startOrdinal, url: host + '/' + filename });
                    }
                }

                const archiveDistanceToCluster = clusterOrdinal - newestOrdinal;
                const total = newestOrdinal - oldestOrdinal + 1;
                logger.log(`Cluster Ordinal: ${chalk.yellow(clusterOrdinal)}, Archive End Ordinal: ${chalk.yellow(newestOrdinal)}, Total Archive Snapshots: ${chalk.yellow(total)}, Distance: ${chalk.yellow(archiveDistanceToCluster)}`);
                return { archiveDistanceToCluster, archives, clusterOrdinal, newestOrdinal, oldestOrdinal, total };
            })
    },

    hasDownloadedRange(start: string, end: string) {

        const dataDir = path.join(APP_ENV.PATH_DATA, 'incremental_snapshot', 'ordinal', start);

        if (!fs.existsSync(dataDir)) {
            return false;
        }

        const files = fs.readdirSync(dataDir);

        logger.log('Checking for downloaded archive range. Start: ' + start + ', End: ' + end + ', Found files: ' + files.length);

        return files.length > Number(end) - Number(start);
    },

    markAsCompleted() {
        const {isRunning, startTime} = storeUtils.getArchiveInfo();

        if (isRunning) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            logger.log(`Archive sync completed in ${Math.floor(duration / 1000)} seconds.`);

            storeUtils.setArchiveInfo({endTime, isRunning: false, pid: ''});
        }
    },

    async runHydrate() {
        const {isRunning} = storeUtils.getArchiveInfo();

        if (isRunning) {
            throw new Error('Archive sync is already running.');
        }

        logger.log('Running hydrate...');

        storeUtils.setArchiveInfo({isRunning: true});

        const hydrateSH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../bin/hydrate.sh`);
        const pid = await shellUtils.runCommandWithOutput(hydrateSH);
        logger.log('pid: ' + pid);
        storeUtils.setArchiveInfo({pid});
    },

    // NOTE: Unable to verify hash from local node as it has left the cluster during archive sync.
    //
    // async verifyArchiveSnapshotHash(ordinal: number) {
    //     const nodeOrdinalHash = await nodeUtils.getNodeOrdinalHash(ordinal);
    //     const sourceNodeOrdinalHash = await clusterUtils.getSourceNodeOrdinalHash(ordinal);
    //
    //     // check if nodeOrdinalHash is an object type
    //     if (typeof nodeOrdinalHash === 'object' || typeof sourceNodeOrdinalHash === 'object') {
    //         logger.log(`API endpoint return an object at ${ordinal} - Archive: ${JSON.stringify(nodeOrdinalHash)}, Source: ${JSON.stringify(sourceNodeOrdinalHash)}.`);
    //         return;
    //     }
    //
    //     if (nodeOrdinalHash !== sourceNodeOrdinalHash) {
    //         logger.log(`Hash mismatch detected at ordinal ${ordinal} - Archive: ${nodeOrdinalHash}, Source: ${sourceNodeOrdinalHash}.\nUsing Fast forward to skip over archive snapshots...`);
    //         await FastforwardUtil.synctoLatestSnapshot();
    //     }
    //
    // }
}

async function downloadAndExtractArchive(a: ArchiveInfo) {
    const dataDir = path.resolve(APP_ENV.PATH_DATA);
    logger.log(`Downloading latest snapshot archive ${chalk.yellow(a.startOrdinal)}-${chalk.yellow(a.endOrdinal)} -  ${a.url}`);
    // await shellService.runCommand(`curl -L ${url} -o ${dataDir}/snapshot.tar.gz`);
    await shellUtils.runCommand(`wget --progress=bar:force -O ${dataDir}/snapshot.tar.gz ${a.url}`);
    logger.log(`Extracting snapshot...`);
    await shellUtils.runCommand(`tar -xf ${dataDir}/snapshot.tar.gz -C ${dataDir}`);
    await shellUtils.runCommand(`rm ${dataDir}/snapshot.tar.gz`);
    logger.log(`Total snapshots downloaded: ${chalk.yellow(a.endOrdinal-a.startOrdinal+1)}`);
    logger.log(`Snapshot downloaded and extracted successfully.`);
}