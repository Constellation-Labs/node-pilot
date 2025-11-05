import {Args, Command, Flags} from '@oclif/core'

import {configStore} from "../config-store.js";
import {projectHelper} from "../helpers/project-helper.js";
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

        const layers = args.layer ? [args.layer as TessellationLayer] : layersToRun;

        const deleteAll = !flags.data && !flags.logs && !flags.jars;
        const deleteLogs = flags.logs || deleteAll;
        const deleteData = flags.data || deleteAll;
        const deleteJars = flags.jars || deleteAll;

        await projectHelper.cleanup(layers, deleteLogs, deleteData, deleteJars);

    }
}
