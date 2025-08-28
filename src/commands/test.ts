import {Command} from "@oclif/core";
import fs from "node:fs";

import {promptHelper} from "../helpers/prompt-helper.js";

export default class Test extends Command {
    static description = 'node pilot test command'
    static hidden = true;


    async run(): Promise<void> {
        // await promptHelper.configureJavaMemoryArguments();
        const r = fs.statfsSync('/');
        const totalSpace = (r.bsize * r.blocks / (1024 * 1024 * 1024)).toFixed(2);
        const totalFreeSpace = (r.bsize * r.bfree / (1024 * 1024 * 1024)).toFixed(2);
        console.log(totalSpace, totalFreeSpace);
    }

}

