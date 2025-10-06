import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {clusterService} from "./cluster-service.js";
import {FastforwardService} from "./fastforward-service.js";
import {shellService} from "./shell-service.js";

// http://5.161.243.241:7777/hash.txt
const remoteIndexMap = {
    integrationnet: "http://5.161.243.241:7777",
    mainnet:  "http://128.140.33.142:7777",
    testnet: "http://65.108.87.84:7777"
}

export const archiverService = {

    async checkLogsForMissingSnapshots() {
        const {projectDir} = configStore.getProjectInfo();

        const dataDir = path.join(projectDir, 'gl0', 'logs', 'app.log');
        const result = await shellService.runCommandWithOutput(`grep -i 'Global snapshot not found for ordinal' ${dataDir}`).catch(() => '');
        let oldestOrdinal = Number.MAX_SAFE_INTEGER;
        for (const line of result.split('\n')) {
            const number = line.match(/\d+/);
            if (number) {
                oldestOrdinal = Math.min(oldestOrdinal, Number(number[0]));
            }
        }

        console.log(`Oldest ordinal: ${oldestOrdinal}`);
    },

    async getArchiveSnapshotInfo() {
        const {type} = configStore.getNetworkInfo();
        const clusterOrdinal = await clusterService.getSourceNodeLatestOrdinal('gl0');
        return fetch(remoteIndexMap[type] + '/hash.txt')
            .then(res => res.text())
            .then(txt => {
                const lines = txt.trim().split('\n');
                const lastLine = lines.at(-1) as string;
                const filename = lastLine.split(' ')[1];
                const parseName = filename.split('.')[0].split('-');
                const startOrdinal = Number(parseName.at(1)?.slice(1));
                const endOrdinal = parseName.length < 4 ? startOrdinal + 20_000 - 1 : Number(parseName.at(3)?.slice(1));
                const distance = clusterOrdinal - endOrdinal;
                const total = endOrdinal - startOrdinal + 1;
                clm.debug(`Cluster Ordinal: ${chalk.yellow(clusterOrdinal)}, Archive End Ordinal: ${chalk.yellow(endOrdinal)}, Total Archive Snapshots: ${chalk.yellow(total)}, Distance: ${chalk.yellow(distance)}`);
                return { clusterOrdinal, distance, endOrdinal, startOrdinal, total, url: remoteIndexMap[type] + '/' + filename };
        })
    },

    getDownloadedSnapshotRange() {

        const {projectDir} = configStore.getProjectInfo();
        const dataDir = path.join(projectDir, 'gl0', 'data', 'incremental_snapshot', 'ordinal');
        const result = { chunkOrdinal: 0, endOrdinal: 0, startOrdinal: 0 };

        if (!fs.existsSync(dataDir)) {
            return result;
        }

        // get last filename in directory
        let files = fs.readdirSync(dataDir);
        if (files.length === 0) return result;

        const latestChunk = files.sort().at(-1) as string;
        if (!latestChunk) return result;

        result.chunkOrdinal = Number(latestChunk);

        files = fs.readdirSync(path.join(dataDir, latestChunk));
        if (files.length === 0) return result;
        const filesSorted = files.sort();

        const firstFile = filesSorted.at(0) as string;
        const lastFile = filesSorted.at(-1) as string;

        result.startOrdinal = Number(firstFile);
        result.endOrdinal = Number(lastFile);

        return result;
    },

    async syncToLatestSnapshot() {

        const { clusterOrdinal, distance: archiveDistance, endOrdinal: remoteArchiveEndOrdinal, startOrdinal: remoteArchiveStartOrdinal, total, url } = await this.getArchiveSnapshotInfo();

        if (archiveDistance > 1000) {
            clm.preStep('Archive is far behind cluster. Initiating fast forward...');
            await FastforwardService.synctoLatestSnapshot();
            return;
        }

        const { endOrdinal: localEndOrdinal, startOrdinal: localStartOrdinal } = this.getDownloadedSnapshotRange();

        const localDistanceFromCluster = clusterOrdinal - localEndOrdinal;

        // if archive can improve local's snapshot range
        const needToSync = remoteArchiveStartOrdinal < localStartOrdinal || remoteArchiveEndOrdinal > localEndOrdinal;

        if (!needToSync) {
            clm.step(`Already near latest ordinal. Skipping sync. Distance: ${localDistanceFromCluster}`);
            return;
        }

        const requiredOldestOrdinal = clusterOrdinal - 10_000;
        const archiveStartOrdinalMeetsOldestRequirement = remoteArchiveStartOrdinal <= requiredOldestOrdinal;

        if (!archiveStartOrdinalMeetsOldestRequirement) {
            clm.preStep  ('Archive is not in the optimal range, but proceeding with available data.');
        }

        const {projectDir} = configStore.getProjectInfo();
        const dataDir = path.join(projectDir, 'gl0', 'data');
        fs.mkdirSync(dataDir, {recursive: true});

        clm.preStep(`Downloading latest snapshot archive ${chalk.yellow(remoteArchiveStartOrdinal)}-${chalk.yellow(remoteArchiveEndOrdinal)}; distance from cluster: ${chalk.yellow(archiveDistance)}\nCurrent oldest local ordinal: ${chalk.yellow(localStartOrdinal)}, Latest cluster ordinal: ${chalk.yellow(clusterOrdinal)}`);
        // await shellService.runCommand(`curl -L ${url} -o ${dataDir}/snapshot.tar.gz`);
        await shellService.runCommand(`wget --progress=bar:force -O ${dataDir}/snapshot.tar.gz ${url}`);
        clm.preStep(`Extracting snapshot...`);
        await shellService.runCommand(`tar -xf ${dataDir}/snapshot.tar.gz -C ${dataDir}`);
        await shellService.runCommand(`rm ${dataDir}/snapshot.tar.gz`);
        clm.postStep(`Total snapshots downloaded: ${chalk.yellow(total)}, Synced to ordinal: ${chalk.yellow(remoteArchiveEndOrdinal)}, Cluster Ordinal: ${chalk.yellow(clusterOrdinal)}, Distance from cluster: ${chalk.yellow(archiveDistance)}`);
        clm.postStep(`Snapshot downloaded and extracted successfully.`);
    }
}