

import { createPrompt, useKeypress } from '@inquirer/core';
import fs from "node:fs";
import os from "node:os";
import ttyTable from "tty-table";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {NodeStatusInfo, statusTableHeader} from "./status-table-helper.js";

// mismatched snapshot hash, cluster fork, lagging behind cluster, stalled state, missing snapshot
// const possibleErrors = [
//     '-',
//     'Bad snapshot hash',
//     'Cluster fork',
//     'Lagging behind',
//     'Stalled state',
//     'Missing snapshot',
// ]
//
// const possibleStates =
//     [
//         'Ready',
//         'Restarting',
//         'Offline',
//         'SessionStarted'
//     ]

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

    // Layer | Uptime | State | Ordinal | Distance from cluster | Cluster State | Error
    // state:  Restarting...
    // cluster state: Ready, Offline, Restarting...
    // possibleErrors: mismatched snapshot hash, cluster fork, lagging behind cluster, stalled state, missing snapshot

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
                    n.error || '-'
                ])
                values[p.layer].ordinal = n.ordinal;
            }
            // const rows = [
            //     ["GL0", '1760103674654', possibleStates[Math.floor(Math.random()*possibleStates.length)], '5174762', String(Math.floor(Math.random()*8)), possibleStates[Math.floor(Math.random()*possibleStates.length)], possibleErrors[Math.floor(Math.random()*possibleErrors.length)]],
            //     ["GL1", '1760102674654', possibleStates[Math.floor(Math.random()*possibleStates.length)], '4174762', String(Math.floor(Math.random()*8)), possibleStates[Math.floor(Math.random()*possibleStates.length)], possibleErrors[Math.floor(Math.random()*possibleErrors.length)]],
            // ]

            this.render(rows);

            process.stdout.write("   *press any key to cancel")

            // eslint-disable-next-line no-await-in-loop
            await sleep(1);
        }
    }

    private render (body: string[][]) {
        const options = { terminalAdapter: true } as never;
        const t1 = ttyTable(statusTableHeader, body, options)

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
