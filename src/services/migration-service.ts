import semver from "semver";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {pilotManager} from "../helpers/pilot-manager.js";
import {projectHelper} from "../helpers/project-helper.js";
import {dockerService} from "./docker-service.js";
import {nodeService} from "./node-service.js";
import {shellService} from "./shell-service.js";
import {systemdService} from "./systemd-service.js";

/*
 * Migration contract:
 * - Keyed by the lowest pilot version that needs this work applied. Use
 *   semver pre-release tags to control which dist-tags fire (e.g.,
 *   '0.24.0-0' fires for both -devnet and the release; '0.24.0-intnet'
 *   only for intnet builds).
 * - Migrations must be IDEMPOTENT — assume they may re-run if a later
 *   migration fails. Use configStore flags to guard one-shot operations.
 * - Set requiresNodeRestart: true when the migration touches files that
 *   are baked into the image or read at container start. The framework
 *   will leave the cluster, stop the node, run the body, rebuild the
 *   image, and restart.
 */

type Migration = {
    description: string;
    requiresNodeRestart?: boolean;
    run: () => Promise<void> | void;
};

const migrations: Record<string, Migration> = {
    '0.24.0-0': {
        description: 'host Java 21; container Java is network-aware (11 for mainnet, 21 elsewhere)',
        requiresNodeRestart: true,
        async run() {
            // Backfill projectInfo.type for users coming from old code that only
            // set `name`. Safe across networks: testnet/intnet installs already
            // populate `type`, so the guard short-circuits.
            const projectInfo = configStore.getProjectInfo();
            if (!projectInfo.type && projectInfo.name) {
                configStore.setProjectInfo({type: projectInfo.name as 'hypergraph' | 'metagraph'});
            }

            configStore.setProjectFlag('javaMemoryChecked', false);
            // Tear down any stale systemd units before refreshing files; we
            // reinstall fresh ones at the end of the body so the safety net
            // (auto-update, restart-unhealthy) is in place after restart.
            await systemdService.uninstall();
            projectHelper.upgradeHypergraph();
            const {type: network} = configStore.getNetworkInfo();
            const JAVA_VERSION = network === 'mainnet' ? '11' : '21';
            await shellService.runProjectCommand('bash scripts/install-dependencies.sh', {JAVA_VERSION});
            await refreshJavaHome();
            await systemdService.install();
        }
    },

    '0.25.0-0': {
        description: 'rebuild the node image to pick up health-check 0.0.40 (notify server) and refreshed seed-list handling',
        requiresNodeRestart: true,
        async run() {
            // Re-copy the bundled hypergraph project — the new Dockerfile pins
            // health-check@0.0.40 — so the image rebuild that follows (driven by
            // requiresNodeRestart) bakes in the updated notify server.
            projectHelper.upgradeHypergraph();
        }
    }
};

export const migrationService = {

    async runMigrations() {
        const {version = '0.0.0'} = configStore.getProjectInfo();
        const {version: pilotVersion} = configStore.getPilotReleaseInfo();

        const lastMigratedVersion = semver.parse(version);
        const currentVersion = semver.parse(pilotVersion);

        if (!lastMigratedVersion || !currentVersion) {
            return;
        }

        clm.debug(`Running migrations from ${lastMigratedVersion.version} to ${currentVersion.version}`);

        const migrationKeys = Object.keys(migrations)
            .filter(v => semver.gt(v, version) && semver.lte(v, currentVersion.version))
            .sort(semver.compare);

        if (migrationKeys.length === 0) {
            clm.debug('No migrations applicable.');
            configStore.setProjectInfo({version: currentVersion.toString()});
            return;
        }

        const summary = migrationKeys.map(k => `${k} (${migrations[k].description})`).join(', ');
        clm.preStep(`Migration versions to run: ${summary}`);

        for (const key of migrationKeys) {
            // eslint-disable-next-line no-await-in-loop
            await runMigration(key, migrations[key]);
            // Stamp per-migration so a later failure doesn't re-run earlier ones.
            configStore.setProjectInfo({version: key});
        }

        configStore.setProjectInfo({version: currentVersion.toString()});
    }

};

async function runMigration(key: string, migration: Migration) {
    clm.step(`Running migration ${key} — ${migration.description}...`);

    if (!migration.requiresNodeRestart) {
        await migration.run();
        return;
    }

    // Claim the restart lock for the whole lifecycle so any cpilot restart
    // commands kicked off by systemd (auto-update, autostart) bail out cleanly.
    pilotManager.setIsRestarting(Date.now());
    try {
        const wasRunning = await dockerService.isRunning();
        if (wasRunning) {
            clm.preStep('Shutting down node to apply migration changes...');
            const {layersToRun} = configStore.getProjectInfo();
            await nodeService.leaveClusterAllLayers();
            await nodeService.pollForLayersState(layersToRun, 'Offline');
            await dockerService.dockerDown();
        }

        await migration.run();

        if (wasRunning) {
            clm.preStep('Rebuilding container with refreshed Dockerfile...');
            await dockerService.dockerBuild();
            clm.preStep('Restarting node...');
            await dockerService.dockerRestartAll();
        }
    } finally {
        pilotManager.setIsRestarting(0);
    }
}

async function refreshJavaHome() {
    if (process.platform !== 'linux') return;
    const javaHome = await shellService
        .runCommandWithOutput('dirname "$(dirname "$(readlink -f "$(which java)")")"')
        .catch(() => '');
    if (javaHome) {
        process.env.JAVA_HOME = javaHome;
        clm.debug(`JAVA_HOME refreshed to ${javaHome} for current process`);
    }
}
