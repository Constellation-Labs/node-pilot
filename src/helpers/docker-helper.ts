import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "../services/shell-service.js";
import {TessellationLayer} from "../types.js";
import {projectHelper} from "./project-helper.js";

export const dockerHelper = {

    async dockerBuild() {
        if (shellService.existsScript('scripts/docker-build.sh')) {
            clm.preStep('Building the node container...');
            await shellService.runCommand('bash scripts/docker-build.sh');
        }
    },

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

        // const userId = await shellService.runCommandWithOutput('echo "$(id -u):$(id -g)"')
        // console.log('Setting DOCKER_USER_ID to', userId);
        // configStore.setDockerEnvInfo({ DOCKER_USER_ID: userId });
        await run('up -d');
    },

    async isPortInUse(port: number){
        return shellService.runCommand(`sudo lsof -i :${port}`, undefined, true).then(Boolean).catch(() => false);
    },

    async isRunning() {
        return shellService.runCommand('docker ps | grep entrypoint.sh', undefined, true).then(Boolean).catch(() => false);
    }
};

function run(command: string, layers?: TessellationLayer[]) {
    const {layersToRun} = configStore.getProjectInfo();
    const args = (layers || layersToRun).map(l => `--profile ${l}`).join(' ');
    return shellService.runCommand(`docker compose ${args} ${command}`, configStore.getDockerEnvInfo());
}