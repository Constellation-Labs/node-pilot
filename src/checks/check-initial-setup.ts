import chalk from "chalk";

import {configStore} from "../config-store.js";
import {checkDependencies} from "./check-dependencies.js";
import {checkHardware} from "./check-hardware.js";

export const checkInitialSetup = {

    async firstTimeRun() {

        if(configStore.getSystemInfo() !== null) {
            return;
        }

        await checkDependencies();

        console.log(chalk.white("\n ****************************************"));
        console.log("          " + chalk.white("CONSTELLATION NETWORK") + "        ");
        console.log("               " + chalk.white("NODE PILOT") + "              ");
        console.log(chalk.white(" ****************************************"));

        await checkHardware.systemRequirements();
    },
};