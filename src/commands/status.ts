
import {Command} from '@oclif/core'

import {checkInitialSetup} from "../checks/check-initial-setup.js";
import {checkLayers} from "../checks/check-layers.js";
import {checkNetwork} from "../checks/check-network.js";
import {checkNodeCtl} from "../checks/check-node-ctl.js";
import {checkNodePilot} from "../checks/check-pilot.js";
import {checkProject} from "../checks/check-project.js";
import {checkWallet} from "../checks/check-wallet.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";

export default class Status extends Command {

    // eslint-disable-next-line no-warning-comments
    // TODO add -f flag to continuously monitor status

  static override description = 'Display node status and configuration settings'

  public async run(): Promise<void> {
    await checkInstallationAndConfigurationStatus();
  }
}

export async function checkInstallationAndConfigurationStatus() {

    await checkInitialSetup.firstTimeRun();
    await checkProject.projectInstallation();
    await checkNetwork.checkExternalIpAddress();
    await checkNetwork.isNetworkConnectable();
    await checkNodePilot.checkDiscordRegistration();
    await checkNodePilot.checkVersion();
    await checkProject.releaseVersion();
    await checkNodeCtl.check4Migration();
    await keyFileHelper.promptIfNoKeyFile();
    await checkNetwork.checkSeedList();
    await checkNetwork.checkForExistingNodeIdInCluster();
    await checkWallet.checkCollateral();
    await checkLayers.layersRunning();
    await checkLayers.layersReadyToJoin();
    await checkLayers.layersStatus();
}
