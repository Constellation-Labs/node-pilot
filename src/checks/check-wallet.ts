import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {promptHelper} from "../helpers/prompt-helper.js";

export const checkWallet = {

    async checkCollateral() {
        const { type } = configStore.getNetworkInfo();

        if (type !== 'mainnet') return;

        const skipCollateralCheck = configStore.hasProjectFlag('skipCollateralCheck');

        if (skipCollateralCheck) return;

        clm.preStep('Checking for required collateral...');

        const {dagAddress} = configStore.getProjectInfo();
        const url = `https://be-mainnet.constellationnetwork.io/addresses/${dagAddress}/balance`;
        let hasError = false;
        const balance: number = await fetch(url)
            .then(res => res.json())
            .then(i => i.data.balance)
            .catch(() => {
                clm.warn(`Failed to fetch balance from ${url}`);
                hasError = true;
            });

        if (!hasError && balance < 25_000_000_000_000) {
            clm.warn(`You need at least 250k DAG to run a validator node. Your account ${chalk.cyan(dagAddress)} has a balance of ${chalk.cyan(balance)} DAG.`);
            hasError = true;
        }

        if (hasError) {
            clm.echo('You may continue and skip this check in the future');
            await promptHelper.doYouWishToContinue();
        }
        else {
            clm.postStep('Collateral check PASSED')
        }

        configStore.setProjectFlag('skipCollateralCheck', true);
    }
}