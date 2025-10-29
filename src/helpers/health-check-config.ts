import {JSONStorage} from "node-localstorage";
import fs from "node:fs";
import path from "node:path";

import {configStore} from "../config-store.js";

export const healthCheckConfig = {

    getUserState(): UserState{
        const hcStorage = getHcStorage();
        const info = hcStorage.getItem('user');
        return info || {};
    },

    setNodeState(state:Partial<NodeState>) {
        const hcStorage = getHcStorage();
        const info = hcStorage.getItem('node');
        hcStorage.setItem('node', {...info, ...state});
    },

    setUserState(state:Partial<UserState>) {
        const hcStorage = getHcStorage();
        const info = hcStorage.getItem('user');
        hcStorage.setItem('user', {...info, ...state});
    }
};

type NodeState = {
    lastError: string
}

type UserState = {
    discordUser?: string;
    webHookEnabled?: boolean;
}

function getHcStorage() {
    const {layersToRun,projectDir} = configStore.getProjectInfo();
    const layer = layersToRun[0];
    const hcPath = path.join(projectDir,layer,'data','health-check');
    if (fs.existsSync(hcPath)) {
        fs.mkdirSync(hcPath, {recursive: true});
    }

    return new JSONStorage(hcPath);
}