
import {serializeBrotli} from "@stardust-collective/dag4-keystore";
import chalk from "chalk";
import fs from "node:fs";
import 'json-bigint-patch';
import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {CHUNK_SIZE} from "../types.js";

export class FastforwardUtil {

    private readonly dataDir: string;
    private readonly lbUrl: string;
    private readonly network: string;
    private readonly tmpDir: string;

    constructor() {

        this.network = APP_ENV.CL_APP_ENV;
        this.tmpDir = path.resolve(APP_ENV.PATH_DATA, 'tmp');
        this.dataDir = path.resolve(APP_ENV.PATH_DATA);

        fs.mkdirSync(this.tmpDir, {recursive: true});
        fs.mkdirSync(this.dataDir, {recursive: true});

        // this.lbUrl = `https://l0-lb-${this.network}.constellationnetwork.io`;
        this.lbUrl = `http://${APP_ENV.CL_L0_PEER_HTTP_HOST}:${APP_ENV.CL_L0_PEER_HTTP_PORT}`;
    }

    static async synctoLatestSnapshot() {
        const ffs = new FastforwardUtil();
        await ffs.runFastForwardSnapshot();
    }

    async runFastForwardSnapshot() {

        const [ordinal, snapshotIncremental, snapshotInfo] = await this.fetchLatestSnapshot();

        const compressedSnapshotIncremental = await serializeBrotli(snapshotIncremental);
        const compressedSnapshotInfo = await serializeBrotli(snapshotInfo);

        const hash = await this.fetchSnapshotHash(ordinal);

        // clm.debug('hash', Buffer.from(jsSha256.sha256(compressedSnapshotIncremental)).toString('hex'));

        const snapshotInfoDir = path.join(this.dataDir, 'snapshot_info');
        fs.mkdirSync(snapshotInfoDir, { recursive: true });
        fs.writeFileSync(path.join(snapshotInfoDir, ordinal.toString()), compressedSnapshotInfo);

        fs.writeFileSync(path.join(this.tmpDir, ordinal.toString() + '.c'), compressedSnapshotIncremental);

        await this.saveSnapshotFiles(ordinal.toString(), hash);

        logger.log(`Fastforward to snapshot "${ordinal}" completed.`);
    }

    private async fetchLatestSnapshot(): Promise<[number,string,string]> {
        const url = `${this.lbUrl}/global-snapshots/latest/combined`;
        logger.debug('Fetching latest snapshot ordinal from: ' + chalk.cyan(url));
        return fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch latest snapshot ordinal: ${res.statusText}`);
                }

                return res.json();
            })
            .then(data => {
                const {ordinal} = data[0].value;
                logger.debug('fetchLatestSnapshot - ' + chalk.cyan(ordinal));
                return [ordinal,data[0],data[1]]
            });
    }

    private async fetchSnapshot(ordinal: number): Promise<string> {
        const url = `${this.lbUrl}/global-snapshots/${ordinal}`;
        logger.debug('Fetching latest snapshot ordinal from: ' + url);
        return fetch(url).then(res => res.json());
    }

    private async fetchSnapshotHash(ordinal: number): Promise<string> {
        const url = `${this.lbUrl}/global-snapshots/${ordinal}/hash`;
        const hash = await fetch(url).then(res => res.json());
        logger.debug('fetchLatestSnapshotHash: ' + chalk.cyan(hash));
        return hash;
    }

    private async saveSnapshotFiles(ordinal: string, hash: string) {

        const fileName = ordinal + '.c';
        const ordinalFile = path.join(this.tmpDir, fileName);
        if (!fs.existsSync(ordinalFile)) {
            logger.error(`File ${ordinalFile} does not exist.`);
            return;
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
        fs.copyFileSync(ordinalFile, destOrdinalFile);

        const hashFile = path.join(hashDir, hash);
        fs.linkSync(destOrdinalFile, hashFile);

        fs.writeFileSync(path.join(this.dataDir, 'snapshot-version'), `${this.network}:${ordinal}`);
    }
}

