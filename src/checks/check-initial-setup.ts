import chalk from "chalk";

import {configStore} from "../config-store.js";
import {checkHardware} from "./check-hardware.js";

export const checkInitialSetup = {

    async firstTimeRun() {

        if(configStore.getSystemInfo() !== null) {
            return;
        }

        console.log(chalk.white("\n ****************************************"));
        console.log("          " + chalk.white("CONSTELLATION NETWORK") + "        ");
        console.log("               " + chalk.white("NODE PILOT") + "              ");
        console.log(chalk.white(" ****************************************"));

        await checkHardware.systemRequirements();
    },
};