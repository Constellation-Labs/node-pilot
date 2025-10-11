
import {serializeBrotli} from "@stardust-collective/dag4-keystore";
import chalk from "chalk";
import fs from "node:fs";
import 'json-bigint-patch';
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {promptHelper} from "../helpers/prompt-helper.js";

const CHUNK_SIZE = 20_000;

export class FastforwardService {

    private readonly dataDir: string;
    private readonly lbUrl: string;
    private readonly network: string;
    private readonly tmpDir: string;

    constructor() {

        const {projectDir} = configStore.getProjectInfo();
        const {type} = configStore.getNetworkInfo();

        this.network = type;
        this.tmpDir = path.join(projectDir, 'gl0', 'tmp');
        this.dataDir = path.join(projectDir, 'gl0', 'data');

        fs.mkdirSync(this.tmpDir, {recursive: true});
        fs.mkdirSync(this.dataDir, {recursive: true});

        // const env = configStore.getEnvNetworkInfo(type);

        this.lbUrl = `https://l0-lb-${this.network}.constellationnetwork.io`;
        // this.lbUrl = `http://${env.CL_L0_PEER_HTTP_HOST}:${env.CL_L0_PEER_HTTP_PORT}`;
    }

    static async synctoLatestSnapshot() {
        const ffs = new FastforwardService();
        await ffs.runFastForwardSnapshot().catch(async (error) => {

            clm.debug(error);

            const {projectDir} = configStore.getProjectInfo();

            const dataDir = path.join(projectDir, 'gl0', 'data', 'incremental_snapshot', 'ordinal');

            if (fs.existsSync(dataDir) && fs.readdirSync(dataDir).length > 0) {
                clm.warn('Failed to fast forward to latest snapshot. Skipping...');
                await promptHelper.doYouWishToContinue();
                return;
            }

            clm.error('Failed to fast forward to latest snapshot. Please try again later.');
        })
    }

    async runFastForwardSnapshot() {

        const [ordinal, snapshotIncremental, snapshotInfo] = await this.fetchLatestSnapshot();

        const compressedSnapshotIncremental = await serializeBrotli(snapshotIncremental);
        const compressedSnapshotInfo = await serializeBrotli(snapshotInfo);

        const hash = await this.fetchSnapshotHash(ordinal);

        // clm.debug('hash', Buffer.from(jsSha256.sha256(compressedSnapshotIncremental)).toString('hex'));

        const snapshotInfoDir = path.join(this.dataDir, 'snapshot_info');
        fs.mkdirSync(snapshotInfoDir, { recursive: true });

        const ordinalDir = path.join(snapshotInfoDir, ordinal.toString());
        clm.debug('Saving compressedSnapshotInfo to: ' + ordinalDir);
        fs.writeFileSync(ordinalDir, compressedSnapshotInfo);

        clm.debug('Saving compressedSnapshotIncremental to: ' + this.tmpDir);
        fs.writeFileSync(path.join(this.tmpDir, ordinal.toString() + '.c'), compressedSnapshotIncremental);

        await this.saveSnapshotFiles(ordinal.toString(), hash);

        clm.postStep(`Fastforward to snapshot "${ordinal}" completed.`);
    }

    private async fetchLatestSnapshot(): Promise<[number,string,string]> {
        const url = `${this.lbUrl}/global-snapshots/latest/combined`;
        clm.debug('Fetching latest snapshot ordinal from: ' + chalk.cyan(url));
        return fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch latest snapshot ordinal: ${res.statusText}`);
                }

                return res.json();
            })
            .then(data => {
                const {ordinal} = data[0].value;
                clm.debug('fetchLatestSnapshot - ' + chalk.cyan(ordinal));
                return [ordinal,data[0],data[1]]
            });
    }

    private async fetchSnapshot(ordinal: number): Promise<string> {
        const url = `${this.lbUrl}/global-snapshots/${ordinal}`;
        clm.debug('Fetching latest snapshot ordinal from: ' + url);
        return fetch(url).then(res => res.json());
    }

    private async fetchSnapshotHash(ordinal: number): Promise<string> {
        const url = `${this.lbUrl}/global-snapshots/${ordinal}/hash`;
        const hash = await fetch(url).then(res => res.json());
        clm.debug('fetchLatestSnapshotHash: ' + chalk.cyan(hash));
        return hash;
    }

    private async saveSnapshotFiles(ordinal: string, hash: string) {

        const fileName = ordinal + '.c';
        const ordinalFile = path.join(this.tmpDir, fileName);
        if (!fs.existsSync(ordinalFile)) {
            clm.error(`File ${ordinalFile} does not exist.`);
        }

        const ordinalRounded = Math.floor(Number(ordinal) / CHUNK_SIZE) * CHUNK_SIZE;

        const hashSubdir = path.join(hash.slice(0, 3), hash.slice(3, 6));
        // const snapshotInfoDir = path.join(OUTPUT_DIR, 'snapshot-info');
        const incrementalSnapshotDir = path.join(this.dataDir, 'incremental_snapshot');
        const hashDir = path.join(incrementalSnapshotDir, 'hash', hashSubdir);
        const ordinalDir = path.join(incrementalSnapshotDir, 'ordinal', ordinalRounded.toString());

        fs.mkdirSync(hashDir, { recursive: true });
        fs.mkdirSync(ordinalDir, { recursive: true });

        const destOrdinalFile = path.join(ordinalDir, ordinal);

        if (fs.existsSync(destOrdinalFile)) {
            clm.warn(`Snapshot ${destOrdinalFile} already exists. Skipping...`);
            return;
        }

        clm.debug(`Saving snapshot ${ordinal} to ${destOrdinalFile}`);
        fs.copyFileSync(ordinalFile, destOrdinalFile);

        const hashFile = path.join(hashDir, hash);
        clm.debug(`Saving hashFile to ${hashFile}`);
        fs.linkSync(destOrdinalFile, hashFile);

        clm.debug(`Saving snapshot version to ${path.join(this.dataDir, 'snapshot-version')}`);
        fs.writeFileSync(path.join(this.dataDir, 'snapshot-version'), `${this.network}:${ordinal}`);
    }
}

