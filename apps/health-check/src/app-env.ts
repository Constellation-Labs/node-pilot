import * as fs from "node:fs";

import packageJson from '../package.json' with {type: 'json'};

class AppEnv {

    CL_APP_ENV: string;
    CL_CLI_HTTP_PORT: string;
    CL_DOCKER_JAVA_OPTS: string;
    CL_EXTERNAL_IP: string;
    CL_GLOBAL_L0_PEER_HTTP_HOST: string;
    CL_GLOBAL_L0_PEER_HTTP_PORT: string;
    CL_GLOBAL_L0_PEER_ID: string;
    CL_L0_PEER_HTTP_HOST: string;
    CL_L0_PEER_HTTP_PORT: string;
    CL_L0_PEER_ID: string;
    CL_LB: string;
    CL_P2P_HTTP_PORT: string;
    CL_PUBLIC_HTTP_PORT: string;
    CL_TESSELATION_LAYER: string;
    IS_GLOBAL_LAYER = false;
    NODE_PILOT_SESSION: string;
    PATH_DATA: string;
    PATH_LOGS: string;
    PILOT_VERSION: string;
    SNAPSHOT_URL_PATH = 'global-snapshots';

    constructor(env: Record<string, string>) {
        this.CL_DOCKER_JAVA_OPTS = env.CL_DOCKER_JAVA_OPTS || '-Xms1024M -Xmx8G -Xss256K ';
        this.CL_PUBLIC_HTTP_PORT = env.CL_PUBLIC_HTTP_PORT || '9000';
        this.CL_GLOBAL_L0_PEER_ID = env.CL_GLOBAL_L0_PEER_ID;
        this.CL_GLOBAL_L0_PEER_HTTP_PORT = env.CL_GLOBAL_L0_PEER_HTTP_PORT || '9000';
        this.CL_GLOBAL_L0_PEER_HTTP_HOST = env.CL_GLOBAL_L0_PEER_HTTP_HOST;
        this.CL_L0_PEER_HTTP_HOST = env.CL_L0_PEER_HTTP_HOST;
        this.CL_L0_PEER_HTTP_PORT = env.CL_L0_PEER_HTTP_PORT || '9000';
        this.CL_L0_PEER_ID = env.CL_L0_PEER_ID;
        this.CL_CLI_HTTP_PORT = env.CL_CLI_HTTP_PORT || '9002';
        this.CL_P2P_HTTP_PORT = env.CL_P2P_HTTP_PORT || '9001';
        this.NODE_PILOT_SESSION = env.NODE_PILOT_SESSION || "-1";
        this.PATH_DATA = env.PATH_DATA || '/app/data';
        this.PATH_LOGS = env.PATH_LOGS || '/app/logs';

        this.CL_APP_ENV = env.CL_APP_ENV;
        this.CL_TESSELATION_LAYER = env.CL_TESSELATION_LAYER;
        this.CL_LB = env.CL_LB;
        this.CL_EXTERNAL_IP = env.CL_EXTERNAL_IP;

        this.PILOT_VERSION = packageJson.version;

        if (this.CL_TESSELATION_LAYER) {
            this.IS_GLOBAL_LAYER = this.CL_TESSELATION_LAYER.charAt(0) === 'g';
            this.SNAPSHOT_URL_PATH = this.IS_GLOBAL_LAYER ? 'global-snapshots' : 'snapshots';
        }
        else {
            console.error("WARNING: environment variable CL_TESSELATION_LAYER is not set. Health check will be disabled.");
        }

        if (!fs.existsSync(this.PATH_LOGS) || !fs.existsSync(this.PATH_DATA)) {
            console.error('ERROR: One or more required directories do not exist. Please make sure that the following directories exist:');
            console.error(`- PATH_LOGS: ${this.PATH_LOGS}`);
            console.error(`- PATH_DATA: ${this.PATH_DATA}`);
            process.exit(1);
        }
    }

}

export const APP_ENV = new AppEnv(process.env as Record<string, string>)