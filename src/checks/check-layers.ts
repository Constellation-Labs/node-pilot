import {input} from "@inquirer/prompts";
import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {dockerHelper} from "../helpers/docker-helper.js";
import {nodeService} from "../services/node-service.js";
import {shellService} from "../services/shell-service.js";
import {TessellationLayer} from "../types.js";

export const checkLayers = {
    async layersReadyToJoin() {
        const {layersToRun} = configStore.getProjectInfo();

        for (const layer of layersToRun) {
            // eslint-disable-next-line no-await-in-loop
            await this.nodeReadyToJoin(layer)
        }
    },

    async layersRunning() {
        const {layersToRun} = configStore.getProjectInfo();

        const promises = layersToRun.map(l => nodeService.getNodeInfo(l));
        const results = await Promise.all(promises);
        const notRunningLayers = results.filter(r => r.state === "Unavailable");

        if (notRunningLayers.length === layersToRun.length) {
            const single = layersToRun.length === 1;
            if (single) {
                clm.preStep(`The Validator Node is not running.`);
            }
            else {
                clm.preStep(`All the Validator Node layers [${layersToRun}] are not running.`);
            }

            await input({ default: 'y', message: 'Would you like to start the validator(s)? (y/n): '}).then(async answer =>  {
                if (answer.toLowerCase() === 'y') {

                    if (shellService.existsScript('scripts/docker-build.sh')) {
                        clm.preStep('Building the node container...');
                        await shellService.runCommand('bash scripts/docker-build.sh');
                    }

                    clm.preStep('Starting the node...');
                    await dockerHelper.dockerUp();
                    await nodeService.pollForLayersState(layersToRun);
                } else {
                    clm.postStep('Node not started.');
                }
            });
        }
        else if (notRunningLayers.length > 0) {
            const layersNotRunning = notRunningLayers.map(r => r.layer);
            clm.preStep('The following Validator Node layers are not running: ' + chalk.cyan(layersNotRunning.join(', ')));
            await input({ default: 'y', message: 'Would you like to restart the docker containers? (y/n): '}).then(async answer =>  {
                if (answer.toLowerCase() === 'y') {
                    clm.preStep('Restarting docker containers...');
                    await dockerHelper.dockerUp();
                    await nodeService.pollForLayersState(layersToRun);
                } else {
                    clm.echo('Node not started.');
                }
            });
        }
        else {
            const single = layersToRun.length === 1;
            if (single) {
                clm.postStep(`The Validator Node is running.`);
            }
            else {
                clm.postStep(`All Validator Node layers are running: ${layersToRun.join(', ')}.`);
            }
        }
    },

    async layersStatus() {
        const {layersToRun} = configStore.getProjectInfo();
        const promises = layersToRun.map(l => nodeService.getNodeInfo(l));
        const results = await Promise.all(promises);
        const states = results.map(r => r.state);

        clm.preStep("-----------------------");
        clm.preStep(" VALIDATOR NODE STATUS ");
        clm.preStep("-----------------------");
        for (const [i, layer] of layersToRun.entries()) {
            const state = states[i];
            clm.step(` "${layer.toUpperCase()}" is "${state}"`);
        }
    },

    async nodeReadyToJoin(layer: TessellationLayer) {
        const status = await nodeService.getNodeInfo(layer);

        if (status.state === "ReadyToJoin") {
            await input({ default: 'y', message: `The validator node layer "${layer.toUpperCase()}" is ready to join the cluster. Would you like to join now? (y/n): `}).then(async answer =>  {
                if (answer.toLowerCase() === 'y') {
                    await nodeService.joinCluster(layer);
                }
            });
        }
    },
};