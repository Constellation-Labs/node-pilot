import semver from "semver";

import packageJson from '../../package.json' with {type: 'json'};
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";

export const migrationService = {

    runMigrations() {
        const migrations: Record<string, () => void> = {
            '0.8.0': m080,
            // add more migrations as needed
        };

        const {version='0.0.0'} = configStore.getProjectInfo();

        const lastMigratedVersion = semver.parse(version);
        const currentVersion = semver.parse(packageJson.version);

        if (!lastMigratedVersion || !currentVersion) {
            return;
        }

        // console.log(`Running migrations from ${lastMigratedVersion.version} to ${currentVersion.version}`);
        // console.log(`semver.gt(v, version): ${semver.gt('0.8.0', version)}`);
        // console.log(`semver.lte(v, currentVersion.version): ${semver.lte('0.8.0', currentVersion.version)}`)

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

function m080() {
    clm.step('Running migration 0.8.0...');
    configStore.setProjectFlag('javaMemoryChecked', false);
}