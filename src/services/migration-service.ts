import semver from "semver";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {projectHelper} from "../helpers/project-helper.js";

export const migrationService = {

    runMigrations() {
        const migrations: Record<string, () => void> = {
            '0.12.5': m0125,
            '0.13.9': m0139,
            '0.14.0-intnet.1': m0140intnet1,
            // add more migrations as needed
        };

        const {version='0.0.0'} = configStore.getProjectInfo();
        const {version: pilotVersion} = configStore.getPilotReleaseInfo();

        const lastMigratedVersion = semver.parse(version);
        const currentVersion = semver.parse(pilotVersion);

        if (!lastMigratedVersion || !currentVersion) {
            return;
        }

        clm.debug(`Running migrations from ${lastMigratedVersion.version} to ${currentVersion.version}`);
        clm.debug(`semver.gt(v, version): ${semver.gt('0.8.0', version)}`);
        clm.debug(`semver.lte(v, currentVersion.version): ${semver.lte('0.8.0', currentVersion.version)}`)

        const migrationVersions = Object.keys(migrations)
            .filter(v => semver.gt(v, version) && semver.lte(v, currentVersion.version))
            .sort(semver.compare);

        if (migrationVersions.length > 0) {
            clm.preStep(`Migration versions to run: ${migrationVersions}`);

            for (const version of migrationVersions) {
                migrations[version]();
            }
        }

        configStore.setProjectInfo({version: currentVersion.toString()});
    }

};

function m0140intnet1() {
    configStore.setProjectFlag('javaMemoryChecked', false);
}

function m0139() {
    clm.step('Running migration 0.13.9...');
    configStore.setProjectFlag('javaMemoryChecked', false);
    projectHelper.upgradeHypergraph();
}

function m0125() {
    clm.step('Running migration 0.12.5...');
    configStore.setProjectFlag('javaMemoryChecked', false);
    // projectHelper.upgradeHypergraph();
    // installJava21();
}

// function installJava21() {
//     const pilotDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../..`);
//     clm.debug(`Running install-java-21.sh from ${pilotDir}`);
//
//     const result = shell.exec('bash install-java-21.sh', {cwd: pilotDir});
//
//     if (result.code > 0) {
//         console.log(result.stderr);
//         clm.error(`Failed to install dependencies. Please try again after resolving any errors.`);
//     }
// }