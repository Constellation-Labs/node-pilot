import {Args, Command, Flags} from '@oclif/core'

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {projectHelper} from "../helpers/project-helper.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {dockerService} from "../services/docker-service.js";
import {shellService} from "../services/shell-service.js";
import {TessellationLayer} from "../types.js";

export default class Clean extends Command {
    static override args = {
        layer: Args.string({description: 'network layer to clean. e.g. gl0', required: true}),
    }
    static override description = 'Remove data and/or logs from a validator node'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    static override flags = {
        all: Flags.boolean({char: 'a', description: 'remove all data and logs'}),
        data: Flags.boolean({char: 'd', description: 'remove data'}),
        logs: Flags.boolean({char: 'l', description: 'remove logs'})
    }

    public async run(): Promise<void> {
        const {args, flags} = await this.parse(Clean);

        const {layersToRun} = configStore.getProjectInfo();

        if (!layersToRun.includes(args.layer as TessellationLayer)) {
            this.error(`Invalid layer: ${args.layer}. Available layers: ${layersToRun.join(',')}`);
        }

        const deleteLogs = flags.logs || flags.all;
        const deleteData = flags.data || flags.all;

        if (!deleteLogs && !deleteData) {
            this.error('At least one of --data or --logs must be specified.');
        }

        if (await dockerService.isRunning()) {
            clm.preStep('The validator node must be stopped first.')
            await promptHelper.doYouWishToContinue();
            await dockerService.dockerDown();
        }

        if (deleteData) {
            await shellService.runProjectCommand(`sudo rm -rf ${args.layer}/data`);
            projectHelper.prepareDataFolder();
        }

        if (deleteLogs) {
            await shellService.runProjectCommand(`sudo rm -rf ${args.layer}/logs`);
        }

    }
}
