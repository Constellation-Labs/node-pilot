import os from "node:os";

import {APP_ENV} from "../app-env.js";
import {logger} from "../logger.js";
import {nodeUtils} from "./node-utils.js";
import {shellUtils} from "./shell-utils.js";
import {storeUtils} from "./store-utils.js";


export const checkUtils = {

    async checkCpuUsage() {
        const {cpuLastTime, cpuLastUsage} = storeUtils.getNodeStatusInfo();
        if (cpuLastTime) {
            const cpuUsage = process.cpuUsage(JSON.parse(cpuLastUsage));
            const cpuCurrentTime = process.hrtime(JSON.parse(cpuLastTime));
            const elapsedTimeInMicros = (cpuCurrentTime[0] * 1_000_000) + (cpuCurrentTime[1] / 1000);
            const numCpus = os.cpus().length;
            const userPercent = (cpuUsage.user / elapsedTimeInMicros) * 100;
            const systemPercent = (cpuUsage.system / elapsedTimeInMicros) * 100;
            const totalPercent = (userPercent + systemPercent) / numCpus;
            storeUtils.setNodeStatusInfo({cpuUsage: totalPercent.toFixed(1)});
            logger.log(`CPU usage: ${totalPercent.toFixed(2)}%`);
            if (totalPercent >= 98) {
                logger.error(`CPU usage has reached ${totalPercent.toFixed(2)}%.`);
                // nodeUtils.leaveCluster();
            }
        }
        else {
            const cpuLastUsage = process.cpuUsage();
            const cpuLastTime = process.hrtime(); // High-resolution time for more accurate elapsed time
            storeUtils.setNodeStatusInfo({cpuLastTime: JSON.stringify(cpuLastTime), cpuLastUsage: JSON.stringify(cpuLastUsage)})

        }

    },

    async checkMemory() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const usedPercent = (usedMem / totalMem) * 100;
        storeUtils.setNodeStatusInfo({memUsage: usedPercent.toFixed(0)});
        if (usedPercent >= 92) {
            logger.error(`Memory usage has reached ${usedPercent.toFixed(2)}%.`);
            await nodeUtils.leaveCluster();
        }
        else {
            const cpuUsage = process.cpuUsage();
            logger.log(`Memory usage: ${usedPercent.toFixed(2)}%\nCPU usage: ${(cpuUsage.system / 1_000_000).toFixed(2)}%`);
        }
    },

    async checkProcessUsage() {

        const results = await shellUtils.runCommandWithOutput('ps -eo %mem,%cpu,rss,command | grep java | grep Xms');
        const metrics = results.split('\n')[0].split(/\s+/);
        const memGB = (Number(metrics[2]) / (1024*1024));
        const maxMem = APP_ENV.CL_DOCKER_JAVA_OPTS.split(' ')[1].slice(4,-1);
        const memPercent = (memGB / Number(maxMem)) * 100;
        const memUsage = `${memPercent.toFixed(0)}% (${memGB.toFixed(1)}/${maxMem})`;
        storeUtils.setNodeStatusInfo({cpuUsage: metrics[1] + '%', memUsage});
    }

};