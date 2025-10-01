import ora from "ora";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {projectHelper} from "../helpers/project-helper.js";
import {TessellationLayer} from "../types.js";
import {shellService} from "./shell-service.js";

export const dockerService = {

    async dockerBuild() {
        if (shellService.existsProjectScript('scripts/docker-build.sh')) {

            const silent = !process.env.DEBUG;
            const spinner = ora('Building the node container...');

            if (silent) {
                spinner.start();
                spinner.color = 'green';
            }
            else {
                clm.preStep('Building the node container...');
            }

            await shellService.runProjectCommand('bash scripts/docker-build.sh', undefined, silent);

            if (silent) {
                spinner.stop();
            }

            clm.postStep('Node container built.');
        }
    },

    async dockerDown() {
        await run('down');
    },

    async dockerRestart(layer: TessellationLayer) {
        await run('restart', [layer]);
    },

    async dockerStartLayers(layers: TessellationLayer[]) {
        await run('up -d', layers);
    },

    async dockerUp() {
        // If docker is already running, stop it
        if (await this.isRunning()) {
            await this.dockerDown();
        }

        await projectHelper.generateLayerEnvFiles();

        // const userId = await shellService.runCommandWithOutput('echo "$(id -u):$(id -g)"')
        // console.log('Setting DOCKER_USER_ID to', userId);
        // configStore.setDockerEnvInfo({ DOCKER_USER_ID: userId });
        await run('up -d');
    },

    async isRunning() {
        return shellService.runCommand('docker ps | grep entrypoint.sh', undefined, true).then(Boolean).catch(() => false);
    }
};

function run(command: string, layers?: TessellationLayer[]) {
    const {layersToRun} = configStore.getProjectInfo();
    const args = (layers || layersToRun).map(l => `--profile ${l}`).join(' ');
    return shellService.runProjectCommand(`docker compose ${args} ${command}`, configStore.getDockerEnvInfo());
}