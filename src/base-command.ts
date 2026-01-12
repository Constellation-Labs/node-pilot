import {select} from "@inquirer/prompts";
// src/base.ts
import { Command, Flags } from '@oclif/core';

import {clm} from "./clm.js";
import {configHelper} from "./helpers/config-helper.js";
import {pilotManager} from "./helpers/pilot-manager.js";

export abstract class BaseCommand extends Command {
    static baseFlags = {
        project: Flags.string({
            char: 'p',
            description: 'Specify the project name to use',
            helpGroup: 'GLOBAL', // Optional: Group this flag in the help output
            // options: configStore.getProjects()
        })
    };

    async checkProject(flags: { project?: string }) {
        configHelper.assertProject('No project found. ');
        if (flags.project) {
            const projects = pilotManager.getProjects();
            if (projects.includes(flags.project)) {
                pilotManager.setActiveProject(flags.project);
                clm.postStep(`Active project set to ${flags.project}`);
            }
            else {
                await select({choices: [...projects, `Create new project [${flags.project}]`], message: 'Change active project'})
            }
        }
    }
}