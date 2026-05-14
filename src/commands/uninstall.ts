import {Command} from '@oclif/core'
import chalk from "chalk";
import os from "node:os";

import {clm} from "../clm.js";
import {promptHelper} from "../helpers/prompt-helper.js";
import {shellService} from "../services/shell-service.js";
import {systemdService} from "../services/systemd-service.js";

export default class Uninstall extends Command {

  static override description = 'Uninstall Node Pilot'
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {

      await promptHelper.shutdownNodeIfRunning();

      const user = os.userInfo().username;

      clm.warn(`You are about to uninstall Node Pilot for ${chalk.cyan(user)}.\nThis will also remove all the data and logs from your validator node.`)
      await promptHelper.doYouWishToContinue();

      clm.preStep('Uninstalling Node Pilot...');

      await systemdService.uninstall();

      const homeDir = os.homedir();
      const nodePilotDir = `${homeDir}/.node-pilot`;

      await shellService.runCommand(`sudo rm -rf ${nodePilotDir}`);

      console.log(`Node Pilot uninstalled successfully for ${chalk.cyan(user)}.`)
  }
}
