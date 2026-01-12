import {input} from "@inquirer/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {NodeParams} from "../types.js";
import {clusterService} from "./cluster-service.js";
import {shellService} from "./shell-service.js";

export const delegatedStakingService = {

    async configureNodeParams() {

        const np = await this.getNodeParams();

        if (np.name) {
            clm.postStep(String('\nEdit node parameters:\n\n  Name: ' + chalk.cyan(np.name) + '\n  Description: ' + chalk.cyan(np.description) + '\n  Reward: ' + chalk.cyan(np.reward + '%') + "\n"));
        }
        else {
            clm.postStep(String('------------------------------\nDelegated Staking Registration\n------------------------------\nFill out the parameters to enable delegation to your Validator Node:\n'));
        }

        const name = await input({
            default: np.name,  message: 'Name (5-140 chars):',
            required: true, validate: (value: string) => value.length > 5 && value.length < 140
        });

        const description = await input({
            default: np.description, message: 'Description (5-140 chars):',
            required: true, validate: (value: string) => value.length > 5 && value.length < 140
        })

        const reward = await input({
            default: String(np.reward), message: 'Commission % (5-10):', required: true,
            validate: (value: string) => Number(value) >= 5 && Number(value) <= 10
        })

        const rewardFraction = Math.floor(Number(reward) * 1_000_000) / 100_000_000;

        const payload = await this.generateNodeParamPayload(rewardFraction, name, description, np.lastRef);

        // console.log(JSON.stringify(JSON.parse(payload),null,2));

        const hash = await clusterService.postNodeParams(payload, 'gl0');

        console.log(hash);

        const {type} = configStore.getNetworkInfo();

        clm.postStep(`Delegated Staking Page: https://${type}.dagexplorer.io/staking`);
    },

    async generateNodeParamPayload(rewardFraction: number, name: string, description: string, lastRef: { hash: string, ordinal: number}) {

        name = name.replaceAll(/['"]/g, match => `\\${match}`);
        description = description.replaceAll(/['"]/g, match => `\\${match}`);
        rewardFraction = Math.max(.05, Math.min(.1, rewardFraction));

        const env= configStore.getEnvInfo();
        const {projectDir} = configStore.getProjectInfo();
        fs.writeFileSync(path.join(projectDir, 'parent.json'), JSON.stringify(lastRef));

        const command = `java -jar dist/wallet.jar create-node-params --reward-fraction ${rewardFraction} --name $'${name}' --description $'${description}' -p 'parent.json'`;

        await shellService.runProjectCommand(command, env);

        return fs.readFileSync(path.join(projectDir, 'event'), 'utf8');
    },

    async getNodeParams(): Promise<NodeParams> {

        const {nodeId} = configStore.getProjectInfo();

        return clusterService.getNodeParams(nodeId)
            .then((params) => {
                if (!params) {
                    return {description: '', lastRef: {hash: '0000000000000000000000000000000000000000000000000000000000000000', ordinal: 0}, name: '', rewardFraction: 5}
                }

                // console.log(JSON.stringify(params,null,2));

                return {
                    description: params.latest.value.nodeMetadataParameters.description,
                    lastRef: params.lastRef,
                    name: params.latest.value.nodeMetadataParameters.name,
                    reward: params.latest.value.delegatedStakeRewardParameters.rewardFraction / 1_000_000
                };
            });
    }
};