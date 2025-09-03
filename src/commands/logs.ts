import {Args, Command, Flags} from '@oclif/core'
import path from "node:path";

import {configStore} from "../config-store.js";
import {configHelper} from "../helpers/config-helper.js";
import {shellService} from "../services/shell-service.js";

export default class Logs extends Command {
    static override args = {
        layer: Args.string({description: 'network layer to view. e.g. gl0'}),
    }
    static override description = 'view validator node runtime logs'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    static override flags = {

      follow: Flags.boolean({char: 'f', description: 'continuously wait for additional data to be appended'}),
    }

    public async run(): Promise<void> {
        configHelper.assertProject('No project found. ');
        let tailFlag = '';
        const {flags} = await this.parse(Logs);
        if (flags.follow) {
            tailFlag = '-f';
        }

        const {projectDir} = configStore.getProjectInfo();
        const logPath = path.join(projectDir, 'app-data', 'gl0-logs', 'app.log');
        await shellService.runCommand(`tail ${tailFlag} ${logPath}`).catch(()=> 1);
    }
}
