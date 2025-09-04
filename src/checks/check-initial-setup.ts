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

        console.log(chalk.whiteBright("\n ****************************************"));
        console.log("          " + chalk.whiteBright("CONSTELLATION NETWORK") + "        ");
        console.log("               " + chalk.whiteBright("NODE PILOT") + "              ");
        console.log(chalk.whiteBright(" ****************************************"));

        await checkHardware.systemRequirements();
    },
};