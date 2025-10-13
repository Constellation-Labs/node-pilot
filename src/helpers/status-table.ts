

import { createPrompt, useKeypress } from '@inquirer/core';
import fs from "node:fs";
import os from "node:os";
import ttyTable from "tty-table";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {NodeStatusInfo, statusTableHeader} from "./status-table-helper.js";

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
        table.monitorState();

        const onKeyPress = createPrompt((_, done) => {
            useKeypress(() => { done(''); });
            return '';
        });

        await onKeyPress({});

        console.log("\u001B[?25h");
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

    private async monitorState() {

        const projects = this.getProjectInfo();
        const values: Record<string, Record<string, number | string>> = {};

        while (true) {
            const rows = [];
            for (const p of projects) {
                if (!values[p.layer]) values[p.layer] = {};
                const n: NodeStatusInfo = JSON.parse(fs.readFileSync(p.path, 'utf8'));
                const projectName = p.project === 'hypergraph' ? '' : p.project;
                const network = p.network === 'integrationnet' ? 'intnet' : p.network;
                const distance = Number.isNaN(n.clusterOrdinal-n.ordinal)  ? '-' : String(n.clusterOrdinal - n.ordinal);
                const ordinal = (values[p.layer].ordinal === n.ordinal) ? String(n.ordinal) : n.ordinal + ':true';
                rows.push([
                    projectName + ':' + network,
                    p.layer,
                    n.session, // n.pilotSession,
                    n.state,
                    n.ordinal ? ordinal : '-',
                    distance,
                    n.clusterState || 'Ready',
                    n.cpuUsage || '-',
                    n.memUsage || '-',
                    n.error || '-'
                ])
                values[p.layer].ordinal = n.ordinal;
            }

            this.render(rows);

            process.stdout.write("   * press any key to cancel")

            // eslint-disable-next-line no-await-in-loop
            await sleep(1);
        }
    }

    private render (rows: string[][]) {
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
        const t1 = ttyTable(header, rows, options)

        // hide cursor
        console.log("\u001B[?25l")

        // wipe existing if already rendered
        if (this.alreadyRendered) {
            // move cursor up number to the top of the previous print before deleting
            console.log(`\u001B[${this.previousHeight + 3}A`)

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
        this.previousHeight = t1.height
    }


}

function sleep(sec: number) {
    return new Promise(resolve => {setTimeout(resolve, sec * 1000)});
}
