import {Command} from "@oclif/core";

import {promptHelper} from "../helpers/prompt-helper.js";

export default class Test extends Command {
    static description = 'node pilot test command'
    static hidden = true;


    async run(): Promise<void> {
        await promptHelper.configureJavaMemoryArguments();
    }

}

