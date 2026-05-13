// import {archiveUtils} from "./utils/archive-utils.js";


// archiveUtils.checkForCorruptAndMissingSnapshots().then(() => {});

// import {nodeUtils} from "./utils/node-utils.js";
//
// const ordinal = nodeUtils.getNodeLatestOrdinalOnDisk()
//
// console.log(ordinal);

import {backupUtils} from "./utils/backup-utils.js";

backupUtils.cleanLogs();

// import {notifyUtils} from "./utils/notify-utils.js";
//
// notifyUtils.notify('test');

// PATH_LOGS=/Users/ffox/.node-pilot/hypergraph/gl0/logs PATH_DATA=/Users/ffox/.node-pilot/hypergraph/gl0/data CL_L0_PEER_HTTP_HOST=13.52.205.240 tsx src/test.ts