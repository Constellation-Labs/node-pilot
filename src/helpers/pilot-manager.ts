import {input} from "@inquirer/prompts";
import chalk from "chalk";
import {JSONStorage} from "node-localstorage";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {clm} from "../clm.js";
import {configStore, EmptyStorage, SystemInfo} from "../config-store.js";
import {shellService} from "../services/shell-service.js";
import {promptHelper} from "./prompt-helper.js";


export class PilotManager {

    private pilotStore: JSONStorage = new EmptyStorage();

    constructor() {
        const appDir = path.join(os.homedir(), '.node-pilot');

        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(path.join(appDir, 'logs'), {recursive: true});
        }

        this.pilotStore = new JSONStorage(path.join(appDir,'config'));

        const appInfo = this.pilotStore.getItem('pilot') as PilotInfo;

        if (appInfo && appInfo.project && fs.existsSync(path.join(appDir, appInfo.project))) {
            const projectPath = path.join(appDir, appInfo.project, 'config');
            configStore.setProjectConfig(projectPath);
        }
        else {
            this.pilotStore.setItem('pilot', { appDir, projects: [], restarting: 0, running: [] } as Partial<PilotInfo>);
        }
    }

    async applyNewProjectStore(name: string, type: 'hypergraph' | 'metagraph') {

        const { appDir, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;
        const projectDir = path.join(appDir, name);

        if (projects.includes(name)) {

            if (fs.existsSync(projectDir)) {
                const answer = await input({
                    default: 'n',
                    message: `Project ${name} already exists. Do you want to reinstall? (y/n):`
                });
                if (answer === 'y') {
                    // this.projectStore = new JSONStorage(path.join(projectDir,'config'));
                    // this.projectStore.clear();
                    fs.rmSync(projectDir, {force: true, recursive: true});
                    this.setPilotInfo({ project: name });
                } else {
                    clm.error(`Project ${name} already exists.`);
                }
            }
            else {
                this.setPilotInfo({ project: name });
            }
        }
        else {
            this.setPilotInfo({ project: name, projects: [...projects, name] });
        }

        fs.mkdirSync(path.join(projectDir,'config'), {recursive: true});

        // this.projectStore = new JSONStorage(path.join(projectDir,'config'));

        configStore.setProjectConfig(path.join(projectDir,'config'));
        configStore.setDockerEnvInfo({ DOCKER_IMAGE_VERSION: 'test' });
        configStore.setProjectInfo({ name, projectDir, type })
    }

    getActiveProject() {
        const {project} = this.pilotStore.getItem('pilot') as PilotInfo;
        return project;
    }

    getAppDir(): string {
        const { appDir }  = this.pilotStore.getItem('pilot') as PilotInfo;
        return appDir;
    }

    getProjectDir(project: string) {
        const { appDir }  = this.pilotStore.getItem('pilot') as PilotInfo;
        const dir = path.join(appDir, project);
        if (fs.existsSync(dir)) return dir;
        throw new Error(`Project ${project} doesn't exist.`);
    }

    getProjects() {
        const { projects }  = this.pilotStore.getItem('pilot') as PilotInfo;
        return projects;
    }

    getRunningProjects(): string[] {
        const { running }  = this.pilotStore.getItem('pilot') as PilotInfo;
        return running;
    }

    getSystemInfo(): SystemInfo {
        return this.pilotStore.getItem('system');
    }

    hasProjects() {
        const { projects } = this.pilotStore.getItem('pilot') as PilotInfo;
        return projects.length > 0;
    }

    isProjectInstalled() {
        const { appDir, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;
        const activeProject = this.getActiveProject();
        return projects.includes(activeProject) && fs.existsSync(path.join(appDir, activeProject));
    }

    isRestarting() {
        const {restarting}  = this.pilotStore.getItem('pilot') as PilotInfo;
        if (restarting && restarting + 1000 * 60 * 5 < Date.now()) {
            this.setIsRestarting(0);
            return false;
        }

        return restarting > 0;
    }

    async removeProject(name: string) {
        let { project, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;
        projects.splice(projects.indexOf(name), 1);
        if (projects.length === 0) {
            clm.error(`Project ${name} cannot be removed as it is the only active project.`);
        }

        if (project === name) {
            project = projects[0];
            if(project) {
                clm.postStep(`Active project has been changed to ${project}`);
            }
        }

        try {
            const projectDir = this.getProjectDir(name);
            clm.warn(`WARNING: This will remove all data and logs associated with the project ${chalk.cyan(name)}. Use with caution.`);
            await promptHelper.doYouWishToContinue();
            clm.warn('Running with "sudo" which may request your password...');
            await shellService.runCommand(`sudo rm -rf ${projectDir}`);
        }
        catch {
            clm.warn(`Project ${name} not found.`);
        }

        this.setPilotInfo({ project, projects });
    }

    setActiveProject(name: string, isNewProject = false) {
        const { appDir, project, projects }  = this.pilotStore.getItem('pilot') as PilotInfo;

        if (projects && projects.includes(name)) {
            if (project === name) return;
            configStore.setProjectConfig(path.join(appDir, name, 'config'));
            this.setPilotInfo({ project: name });
        }
        else if (isNewProject) {
            this.setPilotInfo({ project: name });
        }
        else {
            throw new Error(`Project ${name} doesn't exist.`);
        }
    }

    setIsRestarting(val: number) {
        this.setPilotInfo({restarting: val})
    }

    setProjectStatusToRunning(isRunning: boolean) {
        const { project, running }  = this.pilotStore.getItem('pilot') as PilotInfo;
        if (isRunning) {
            if (running.includes(project)) return;
            this.setPilotInfo({ running: [...running, project] });
        }
        else {
            if (!running.includes(project)) return;
            running.splice(running.indexOf(project), 1);
            this.setPilotInfo({ running });
        }
    }

    setSystemInfo(info: Partial<SystemInfo>) {
        const oldInfo = this.pilotStore.getItem('system');
        this.pilotStore.setItem('system', { ...oldInfo, ...info });
    }

    // private getPilotInfo(): PilotInfo {
    //     return this.pilotStore.getItem('pilot') as PilotInfo;
    // }

    private setPilotInfo(info: Partial<PilotInfo>) {
        const oldInfo = this.pilotStore.getItem('pilot') as PilotInfo;
        this.pilotStore.setItem('pilot', { ...oldInfo, ...info });
    }
}

export const pilotManager = new PilotManager();

type PilotInfo = {
    appDir: string;
    project: string;
    projects: string[];
    restarting: number;
    running: string[];
}