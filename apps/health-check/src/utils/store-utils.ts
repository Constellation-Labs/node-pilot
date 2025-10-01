import {JSONStorage} from "node-localstorage";
import os from "node:os";
import path from "node:path";

import {ArchiveInfo, BackupInfo, NodeStatusInfo, TimerInfo} from "../types.js";

const store = new JSONStorage(path.join(os.homedir(),'hc-config'));

export const storeUtils = {

    getArchiveInfo() : ArchiveInfo {
        return store.getItem('archive') || {};
    },

    getBackupInfo() : BackupInfo {
        return store.getItem('backup') || {};
    },

    getLastState(): string {
        const {lastState = ''} = this.getTimerInfo();
        return lastState;
    },

    getNodeStatusInfo() : NodeStatusInfo {
        return store.getItem('node') || {};
    },


    getTimerInfo(): TimerInfo {
        return store.getItem('timers') || {};
    },

    setArchiveInfo(info: Partial<ArchiveInfo>) {
        const old = store.getItem('archive');
        store.setItem('archive', { ...old, ...info });
    },

    setBackupInfo(info: Partial<BackupInfo>) {
        const old = store.getItem('backup');
        store.setItem('backup', { ...old, ...info });
    },

    setLastState(val: string) {
        const {lastState = ''} = this.getTimerInfo();
        if (lastState !== val) {
            if (lastState) {
                this.setTimerInfo({[lastState + 'StartTime']: 0});
            }

            this.setTimerInfo({lastState: val});
        }
    },
    setNodeStatusInfo(info: Partial<NodeStatusInfo>) {
        const old = store.getItem('node');
        store.setItem('node', { ...old, ...info });
    },

    setTimerInfo(info: Partial<TimerInfo>) {
        const old = store.getItem('timers');
        store.setItem('timers', { ...old, ...info });
    }
}