import {archiveUtils} from "./utils/archive-utils.js";

// eslint-disable-next-line unicorn/prefer-top-level-await
archiveUtils.checkForCorruptAndMissingSnapshots().then(() => {});

// import {backupUtils} from "./utils/backup-utils";
//
// backupUtils.backupLogs();

// PATH_LOGS=/Users/ffox/.node-pilot/hypergraph/app-data/gl0-logs PATH_DATA=/Users/ffox/.node-pilot/hypergraph/app-data/gl0-data CL_L0_PEER_HTTP_HOST=13.52.205.240 tsx src/test.ts