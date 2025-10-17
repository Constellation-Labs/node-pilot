

import { createPrompt, useKeypress } from '@inquirer/core';
import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import ttyTable from "tty-table";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {formatTimeAgo, glHeader1, glHeader2, NodeStatusInfo, statusTableHeader} from "./status-table-helper.js";

export class StatusTable {
    private alreadyRendered = false;
    private previousHeight = 0;

    static async run() {

        process.on("exit", () => {
            // show cursor
            console.log("\u001B[?25h");
        });

        process.on("SIGINT", () => {
            process.exit()
        })

        const table = new StatusTable();

        const cols = process.stdout.columns;

        console.log(String('Colspan: ' + cols));

        if (cols > 120) {
            table.monitorWide();
        }
        else {
            table.monitorNarrow();
        }

        const onKeyPress = createPrompt((_, done) => {
            useKeypress(() => { done(''); });
            return '';
        });

        await onKeyPress({});

        process.exit();
    }

    private getProjectInfo() {
        const appPath = os.homedir() + '/.node-pilot';
        const activeProject = configStore.getActiveProject();
        const projects = configStore.getRunningProjects();
        if (!activeProject || projects.length === 0)  {
            clm.error("No running projects found.");
        }

        const info = [];
        for (const project of projects) {
            configStore.setActiveProject(project);
            const {layersToRun} = configStore.getProjectInfo();
            const {type:network} = configStore.getNetworkInfo();
            for (const layer of layersToRun) {
                info.push({ layer, network, path: `${appPath}/${project}/${layer}/data/health-check/node`, project})
            }
        }

        configStore.setActiveProject(activeProject);

        return info;
    }

    private async monitorNarrow() {

        const projectInfos = this.getProjectInfo();
        const values: Record<string, Record<string, number | string>> = {};
        // const err = { date: '', layer: '', msg:'', timeAgo: '' }

        while (true) {
            // const rows = [];
            const tables: Table[] = [];

            for (const info of projectInfos) {
                if (!values[info.layer]) values[info.layer] = {};
                const n: NodeStatusInfo = fs.existsSync(info.path) ? JSON.parse(fs.readFileSync(info.path, 'utf8')) : {};
                const projectName = info.project === 'hypergraph' ? '' : ':' + info.project;
                const network = info.network === 'integrationnet' ? 'intnet' : info.network;
                const distance = Number.isNaN(n.clusterOrdinal-n.ordinal)  ? '-' : String(n.clusterOrdinal - n.ordinal);
                const ordinal = (values[info.layer].ordinal === n.ordinal) ? String(n.ordinal) : n.ordinal + ':true';
                const label = info.layer + ':' + network + projectName;
                const row1 = [
                    n.state,
                    n.session,
                    n.ordinal ? ordinal : '-',
                    distance,
                ];
                const row2 = [
                    n.clusterState || 'Ready',
                    n.cpuUsage || '-',
                    n.memUsage || '-',
                    n.error || '-'
                ];

                values[info.layer].ordinal = n.ordinal;
                let errorMsg = '';
                if ((info.layer === 'gl0' || info.layer === 'ml0') && n.lastError) {
                    const d = new Date(n.errorDate);
                    // if under 8 hours ago
                    if ((d.getTime() + (8 * 60 * 60 * 1000) > Date.now())) {
                        const date = new Date(n.errorDate).toISOString();
                        const timeAgo = formatTimeAgo(Date.now() - n.errorDate) || '';
                        errorMsg = chalk.green(`   AUTO HEALED (${timeAgo}): `) + chalk.yellowBright(`${n.lastError} - ${date}`);
                    }
                }

                tables.push({error: errorMsg, label, row1:[row1], row2:[row2]});
            }

            this.renderNarrow(tables);

            process.stdout.write("\n   * press any key to cancel")

            // eslint-disable-next-line no-await-in-loop
            await sleep(1);
        }
    }

    private async monitorWide() {

        const projectInfos = this.getProjectInfo();
        const values: Record<string, Record<string, number | string>> = {};
        // const err = { date: '', layer: '', msg:'', timeAgo: '' }

        while (true) {
            const rows = [];
            // const projects: { error: string; label: string, row1: string[][], row2: string[][] }[] = [];

            let errorMsg = '';

            for (const info of projectInfos) {
                if (!values[info.layer]) values[info.layer] = {};
                const n: NodeStatusInfo = fs.existsSync(info.path) ? JSON.parse(fs.readFileSync(info.path, 'utf8')) : {};
                const projectName = info.project === 'hypergraph' ? '' : ':' + info.project;
                const network = info.network === 'integrationnet' ? 'intnet' : info.network;
                const distance = Number.isNaN(n.clusterOrdinal-n.ordinal)  ? '-' : String(n.clusterOrdinal - n.ordinal);
                const ordinal = (values[info.layer].ordinal === n.ordinal) ? String(n.ordinal) : n.ordinal + ':true';
                // const label = info.layer + ':' + network + projectName;
                rows.push([
                    projectName + ':' + network,
                    info.layer,
                    n.session, // n.pilotSession,
                    n.state,
                    n.ordinal ? ordinal : '-',
                    distance,
                    n.clusterState || 'Ready',
                    n.cpuUsage || '-',
                    n.memUsage || '-',
                    n.error || '-'
                ])
                values[info.layer].ordinal = n.ordinal;

                if ((info.layer === 'gl0' || info.layer === 'ml0') && n.lastError) {
                    const d = new Date(n.errorDate);
                    // if under 8 hours ago
                    if ((d.getTime() + (8 * 60 * 60 * 1000) > Date.now())) {
                        const date = new Date(n.errorDate).toISOString();
                        const timeAgo = formatTimeAgo(Date.now() - n.errorDate) || '';
                        errorMsg = chalk.green(`   AUTO HEALED (${timeAgo}): `) + chalk.yellowBright(`${n.lastError} - ${date}`);
                    }
                }

                // projects.push({ error: errorMsg, label, row1, row2 });
            }

            this.renderWide({ error: errorMsg, label: '', row1: rows, row2: []});

            process.stdout.write("\n   * press any key to cancel")

            // eslint-disable-next-line no-await-in-loop
            await sleep(1);
        }
    }

    private renderNarrow (project: { error: string; label: string, row1: string[][], row2: string[][] }[]) {
        const options = { terminalAdapter: true } as never;


        // hide cursor
        console.log("\u001B[?25l")

        // wipe existing if already rendered
        if (this.alreadyRendered) {
            // move cursor up number to the top of the previous print before deleting
            console.log(`\u001B[${this.previousHeight}A`)

            // delete to end of terminal
            console.log("\u001B[0J")
        } else {
            this.alreadyRendered = true
        }

        this.previousHeight = 0;

        for (const p of project) {

            const t1 = ttyTable(glHeader1, p.row1, options)
            const t2 = ttyTable(glHeader2, p.row2, options)
            process.stdout.write("   " + chalk.cyanBright(chalk.bold(p.label)));
            process.stdout.write(t1.render())
            process.stdout.write(t2.render())

            // reset the previous height to the height of this output
            // for when we next clear the print
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            this.previousHeight += t1.height + t2.height + 1;

            if (p.error) {
                process.stdout.write("\n" + p.error + "\n")
                this.previousHeight++;
                this.previousHeight++;
            }

            console.log("");
        }
    }

    private renderWide (table:Table) {
        const header = [...statusTableHeader];

        // const emptyColumns = Array.from({length: rows[0].length}).fill(0) as number[];
        // for (const [, row] of rows.entries()) {
        //     for (const [j, cell] of row.entries()) {
        //         if (cell === '-') emptyColumns[j] += 1;
        //     }
        // }
        //
        // for (const [j, cell] of emptyColumns.entries()) {
        //     if(cell === rows.length) {
        //         header.splice(j, 1);
        //         for (const [, row] of rows.entries()) {
        //             row.splice(j, 1);
        //         }
        //     }
        // }

        const options = { terminalAdapter: true } as never;
        const t1 = ttyTable(header,table.row1, options)

        // hide cursor
        console.log("\u001B[?25l")

        // wipe existing if already rendered
        if (this.alreadyRendered) {
            // move cursor up number to the top of the previous print before deleting
            console.log(`\u001B[${this.previousHeight + 4}A`)

            // delete to end of terminal
            console.log("\u001B[0J")
        } else {
            this.alreadyRendered = true
        }

        console.log(t1.render())

        // reset the previous height to the height of this output
        // for when we next clear the print
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this.previousHeight = t1.height;

        if (table.error) {
            console.log(table.error);
            this.previousHeight++;
        }
    }


}

function sleep(sec: number) {
    return new Promise(resolve => {setTimeout(resolve, sec * 1000)});
}

type Table = {
    error: string;
    label: string,
    row1: string[][],
    row2: string[][]
}
