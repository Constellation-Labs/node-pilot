import os from "node:os";

import {logger} from "../logger.js";
import {nodeUtils} from "./node-utils.js";

export const checkUtils = {

    async checkMemory() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const usedPercent = (usedMem / totalMem) * 100;
        if (usedPercent >= 90) {
            logger.error(`Memory usage has reached ${usedPercent.toFixed(2)}%.`);
            await nodeUtils.leaveCluster();
        }
        else {
            const cpuUsage = process.cpuUsage();
            logger.log(`Memory usage: ${usedPercent.toFixed(2)}%\nCPU usage: ${(cpuUsage.system / 1_000_000).toFixed(2)}%`);
        }
    },

};