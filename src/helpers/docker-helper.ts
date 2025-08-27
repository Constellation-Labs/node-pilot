import {configStore} from "../config-store.js";
import {shellService} from "../services/shell-service.js";
import {TessellationLayer} from "../types.js";
import {projectHelper} from "./project-helper.js";

export const dockerHelper = {

    async dockerDown() {
        await run('down');
    },

    async dockerRestart() {
        await run('restart');
    },

    async dockerUp() {
        // If docker is already running, stop it
        if (await this.isRunning()) {
            await this.dockerDown();
        }

        await projectHelper.generateLayerEnvFiles();
        await run('up -d');
    },

    async isRunning() {
        return shellService.runCommand('docker ps | grep entrypoint.sh', undefined, true).then(() => true).catch(() => false);
    }
};

function run(command: string, layers?: TessellationLayer[]) {
    const {layersToRun} = configStore.getProjectInfo();
    const args = (layers || layersToRun).map(l => `--profile ${l}`).join(' ');
    return shellService.runCommand(`docker compose ${args} ${command}`, configStore.getDockerEnvInfo());
}