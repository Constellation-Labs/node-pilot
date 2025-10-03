// src/base.ts
import { Command, Flags } from '@oclif/core';

import {configStore} from "./config-store.js";
import {configHelper} from "./helpers/config-helper.js";

export abstract class BaseCommand extends Command {
    static baseFlags = {
        project: Flags.string({
            char: 'p',
            description: 'Specify the project name to use',
            helpGroup: 'GLOBAL', // Optional: Group this flag in the help output
            options: configStore.getProjects()
        })
    };

    checkProject(flags: { project?: string }) {
        configHelper.assertProject('No project found. ');
        if (flags.project) {
            configStore.setActiveProject(flags.project);
        }
    }
}