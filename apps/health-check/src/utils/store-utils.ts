import {JSONStorage} from "node-localstorage";
import path from "node:path";

import {APP_ENV} from "../app-env.js";
import {ArchiveInfo, BackupInfo, NodeStatusInfo, TimerInfo, UserInfo} from "../types.js";

const store = new JSONStorage(path.resolve(APP_ENV.PATH_DATA,'health-check'));

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

    getUserInfo(): UserInfo {
        return store.getItem('user') || {};
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
        if (info.error) info.errorDate = Date.now();
        store.setItem('node', { ...old, ...info });
    },

    setTimerInfo(info: Partial<TimerInfo>) {
        const old = store.getItem('timers');
        store.setItem('timers', { ...old, ...info });
    },

    setUserInfo(info: Partial<UserInfo>) {
        const old = store.getItem('user');
        store.setItem('user', { ...old, ...info });
    },
}