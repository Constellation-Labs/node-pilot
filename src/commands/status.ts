
import {Command} from '@oclif/core'

import {checkInitialSetup} from "../checks/check-initial-setup.js";
import {checkLayers} from "../checks/check-layers.js";
import {checkProject} from "../checks/check-project.js";
import {keyFileHelper} from "../helpers/key-file-helper.js";
import {checkNodeCtl} from "../checks/check-node-ctl.js";

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
    await checkNodeCtl.check4Migration();
    await checkProject.releaseVersion();
    await keyFileHelper.promptIfNoKeyFile();
    await checkLayers.layersRunning();
    await checkLayers.layersReadyToJoin();
    await checkLayers.layersStatus();
}
