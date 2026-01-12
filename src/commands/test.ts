import {Command} from "@oclif/core";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {archiverService} from "../services/archiver-service.js";
import {getRandomNode} from "../services/get-random-node.js";
import {notifyService} from "../services/notify-service.js";
import {StatusTable} from "../helpers/status-table.js";
import {checkNodePilot} from "../checks/check-pilot.js";
import semver from "semver";
import {delegatedStakingService} from "../services/delegated-staking-service.js";
import {checkDiskSpace} from "../checks/check-disk-space.js";
import {projectHelper} from "../helpers/project-helper.js";

export default class Test extends Command {
    static description = 'node pilot test command'
    static hidden = true;


    async run(): Promise<void> {
        // await checkNodeCtl.importKeyInfo(path.resolve('/Users/ffox/Projects/Constellation/node-pilot/cn-config.yaml'));

        // await this.testRandomNode();

        // const info = await archiverService.getArchiveSnapshotInfo();
        // console.log(info);
        // const ordinal = archiverService.getDownloadedSnapshotRange();
        // console.log(ordinal)
        //
        // await archiverService.syncToLatestSnapshot();

        // await archiverService.checkLogsForMissingSnapshots();

        // await StatusTable.run();

        // await checkDiskSpace.checkDiskUsage();

        projectHelper.upgradeHypergraph();

        // await delegatedStakingService.postNodeParams(0.08, "Doc Holliday", 'Come and get "som\'e" rewards!', {hash: "0000000000000000000000000000000000000000000000000000000000000000", ordinal: 123_456});
        // await delegatedStakingService.configureNodeParams();

        // console.log(semver.parse("0.11.0-testnet")?.compare('0.11.0'));

        // await checkNodePilot.checkVersion();
    }

    async testRandomNode() {
        const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../projects/hypergraph/networks/mainnet/source-nodes.env`);
        const conetent = fs.readFileSync(filePath);
        const parsed = dotenv.parse(conetent);
        const nodes = ['1','2','3'].map(i => {
            return { host: parsed[`SOURCE_NODE_${i}_HOST`], id: parsed[`SOURCE_NODE_${i}_ID`], publicPort: parsed[`SOURCE_NODE_${i}_PORT`]}
        });
        const n = await getRandomNode(nodes);
        console.log('Random node:', n);
    }

}

// type NetworkEnvType = {
//     SOURCE_NODE_1_HOST:string,
//     SOURCE_NODE_1_ID:string,
//     SOURCE_NODE_1_PORT:string,
//     SOURCE_NODE_2_HOST:string,
//     SOURCE_NODE_2_ID:string,
//     SOURCE_NODE_2_PORT:string,
//     SOURCE_NODE_3_HOST:string,
//     SOURCE_NODE_3_ID:string,
//     SOURCE_NODE_3_PORT:string,
// }