import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import ttyTable from "tty-table";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {promptHelper} from "../helpers/prompt-helper.js";

export const checkHardware = {

    async systemRequirements () {

        clm.preStep('Checking hardware requirements...');

        // Retrieve disk space
        const r = fs.statfsSync('/');
        const totalSpaceGB = (r.bsize * r.blocks / (1024 * 1024 * 1024)).toFixed(2);
        // const usage = diskusage.checkSync(os.homedir());
        // const usableSpaceGB = (usage.total / (1024 * 1024 * 1024)).toFixed(2);

        // Retrieve sys memory
        const totalMemoryBytes = os.totalmem();
        const totalMemoryGB = (totalMemoryBytes / (1024 * 1024 * 1024)).toFixed(2)

        // Retrieve number of CPU cores
        const numOfCores = os.availableParallelism();

        let allPassed = true;
        const formatActual = (value: number | string, recommended: number, units = '') => {
            const passed = Math.ceil(Number(value)) >= recommended;
            allPassed = allPassed && passed;
            return passed ? chalk.greenBright(value + units) : chalk.redBright(value + units)
        }

        // eslint-disable-next-line unicorn/consistent-function-scoping
        const fc = (value: string) => chalk.white(value)

        const header = [
            { headerColor: 'white', value: 'HARDWARE' },
            { headerColor: 'white', value: 'RECOMMENDED' },
            { headerColor: 'white', value: 'ACTUAL' },
        ];

        const rows = [
            [fc("Disk size"), fc("240 GB"), formatActual(totalSpaceGB, 240, " GB")],
            [fc("System memory"), fc("16 GB"), formatActual(totalMemoryGB, 16, " GB")],
            [fc("CPU cores"), fc("8 cores"), formatActual(numOfCores, 8, " cores")],
        ]

        clm.echo(ttyTable(header,rows).render() + "\n");

        if (allPassed) {
            clm.postStep(" ✅ System requirements check passed  ✅\n");
            await promptHelper.doYouWishToContinue();
        }
        else {
            clm.warn("System recommendations not met. The validator node may not function properly.\n");
            await promptHelper.doYouWishToContinue('n');
        }

        configStore.setSystemInfo({ cores: numOfCores, disk: totalSpaceGB, memory: totalMemoryGB, platform: os.platform(), user: os.userInfo().username });

    }
}