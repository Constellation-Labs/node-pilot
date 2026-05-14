import {select} from "@inquirer/prompts";
import {Command, Flags} from '@oclif/core'

import {clm} from "../clm.js";
import {pilotManager} from "../helpers/pilot-manager.js";

export default class Project extends Command {
    static override description = 'Create a new project, list all projects or change active project'
    static override examples = [
        '<%= config.bin %> <%= command.id %>',
    ]
    static override flags = {
        create: Flags.string({char: 'c', description: 'create a new project with the given name'}),
        delete: Flags.string({char: 'd', description: 'delete a project with the given name. WARNING: this will remove all data and logs associated with the project. Use with caution.'}),
    }
    static hidden = true;

    async checkProject(project: string) {

        if (project) {
            const projects = pilotManager.getProjects();
            if (projects.includes(project)) {
                pilotManager.setActiveProject(project);
                clm.postStep(`Active project set to ${project}`);
            }
            else {
                const choices = projects.map(p => ({ name: p, value: p}));
                choices.push({ name: `Create new project [${project}]`, value: project});
                const choice = await select({choices, message: 'Change active project'});
                console.log(choice, project);
                if(choice === project) {
                    pilotManager.setActiveProject(project, true);
                }
            }
        }
    }

    public async run(): Promise<void> {
        const {flags} = await this.parse(Project)

        if (flags.create) {
            await this.checkProject(flags.create);
        }
        else if (flags.delete) {
            await pilotManager.removeProject(flags.delete);
        }
        else {
            clm.preStep('Available projects: ' + pilotManager.getProjects().join(', '));
            clm.postStep('Active project: ' + pilotManager.getActiveProject());
        }
    }
}
