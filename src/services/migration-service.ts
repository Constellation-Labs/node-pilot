import chalk from "chalk";
import semver from "semver";

import packageJson from '../../package.json' with {type: 'json'};
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "./shell-service.js";

export const migrationService = {

    async runMigrations() {
        const migrations: Record<string, () => Promise<void>> = {
            '0.8.0': m080,
            '0.12.3': m0123,
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
                // eslint-disable-next-line no-await-in-loop
                await migrations[version]();
            }
        }

        configStore.setProjectInfo({version: currentVersion.toString()});
    }

};

async function m0123() {
    clm.step('Running migration 0.12.3...');
    const {type} = configStore.getNetworkInfo();
    if (type === 'integrationnet') {
        clm.preStep('Installing Node Pilot IntegrationNet version...')
        await shellService.runCommand('sudo npm install -g @constellation-network/node-pilot@intnet')
        clm.postStep('IntegrationNet version installed successfully.');
        clm.warn(`Run ${chalk.cyanBright('cpilot')} again to start using the IntegrationNet version.`);
        process.exit(0);
    }
}

async function m080() {
    clm.step('Running migration 0.8.0...');
    configStore.setProjectFlag('javaMemoryChecked', false);
}