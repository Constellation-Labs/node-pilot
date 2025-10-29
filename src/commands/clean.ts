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
        layer: Args.string({description: 'network layer to clean. e.g. gl0', required: false}),
    }
    static override description = 'Remove data and/or logs from a validator node'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    static override flags = {
        data: Flags.boolean({char: 'd', description: 'remove only data'}),
        jars: Flags.boolean({char: 'j', description: 'remove only jars'}),
        logs: Flags.boolean({char: 'l', description: 'remove only logs'})
    }

    public async run(): Promise<void> {
        const {args, flags} = await this.parse(Clean);

        const {layersToRun} = configStore.getProjectInfo();

        if (args.layer && !layersToRun.includes(args.layer as TessellationLayer)) {
                this.error(`Invalid layer: ${args.layer}. Available layers: ${layersToRun.join(',')}`);
            }

        const layers = args.layer ? [args.layer] : layersToRun;

        const deleteAll = !flags.data && !flags.logs && !flags.jars;
        const deleteLogs = flags.logs || deleteAll;
        const deleteData = flags.data || deleteAll;
        const deleteJars = flags.jars || deleteAll;

        if (await dockerService.isRunning()) {
            clm.preStep('The validator node must be stopped first.')
            await promptHelper.doYouWishToContinue();
            await dockerService.dockerDown();
        }

        clm.preStep('Requesting sudo permission to remove files...');

        for (const layer of layers) {
            if (deleteData) {
                // eslint-disable-next-line no-await-in-loop
                await shellService.runProjectCommand(`sudo rm -rf ${layer}/data`);
                if (layer === 'gl0') {
                    projectHelper.prepareDataFolder();
                    configStore.setProjectFlag('discordChecked', false);
                }
            }

            if (deleteLogs) {
                // eslint-disable-next-line no-await-in-loop
                await shellService.runProjectCommand(`sudo rm -rf ${layer}/logs`);
            }

            if (deleteJars) {
                // eslint-disable-next-line no-await-in-loop
                await shellService.runProjectCommand(`sudo rm -rf ${layer}/dist`);
            }
        }



    }
}
