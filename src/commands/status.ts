
import {Command} from '@oclif/core'

import {checkInitialSetup} from "../checks/check-initial-setup.js";
import {checkLayers} from "../checks/check-layers.js";
import {checkNetwork} from "../checks/check-network.js";
import {checkNodePilot} from "../checks/check-pilot.js";
import {checkProject} from "../checks/check-project.js";
import {checkWallet} from "../checks/check-wallet.js";
import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {dockerService} from "../services/docker-service.js";
import {migrationService} from "../services/migration-service.js";

export default class Status extends Command {

  static override description = 'Display node status and configuration settings'

  public async run(): Promise<void> {
    await checkInstallationAndConfigurationStatus();
  }
}

export async function checkInstallationAndConfigurationStatus() {

    await checkInitialSetup.firstTimeRun();
    await checkNodePilot.checkMultipleUsers();
    await checkProject.projectInstallation();
    await checkNodePilot.checkVersion();

    migrationService.runMigrations();

    await checkProject.checkJavaMemory();
    await checkNetwork.checkExternalIpAddress();

    if(!await checkNetwork.isNetworkConnectable()) {
        if (await dockerService.isRunning()) {
            await checkLayers.layersStatus();
            return;
        }

        const {type} = configStore.getNetworkInfo();
        clm.error(`${type} is currently offline. Please try again later.`);
    }

    await checkNodePilot.checkDiscordRegistration();
    await checkProject.releaseVersion();
    await keyFileHelper.promptIfNoKeyFile();
    await checkNetwork.checkSeedList();
    await checkNetwork.checkForExistingNodeIdInCluster();
    await checkWallet.checkCollateral();
    await checkLayers.layersRunning();
    await checkLayers.layersReadyToJoin();
    await checkLayers.layersStatus();
}
