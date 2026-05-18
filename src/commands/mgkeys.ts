/* eslint-disable perfectionist/sort-objects */
import {Args, Command, Flags} from '@oclif/core'

import {keyFileHelper} from "../helpers/key-file-helper.js";

export default class Mgkeys extends Command {
  static override args = {
    prefix: Args.string({description: 'A short name to be used for the key file prefix', required: true}),
  }
  static override description = 'generate new keys for a metagraph'
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]
  static override flags = {
    alias: Flags.string({char: 'a', default: 'alias', description: 'alias to use for each key'}),
    complexity: Flags.integer({char: 'l', description: 'generate new password with specified length', max: 128, min: 4}),
    password: Flags.string({char: 'p', default: 'password', description: 'if no complexity is specified, apply this value for each key'}),
  }
  static hidden = true;
  private NAMES = ['node-1', 'node-2', 'node-3', 'owner', 'staking'];

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Mgkeys)

    const {alias, complexity, password} = flags;
    const passwords = Array.from({length: 5}, () =>
      complexity
        ? Array.from({length: complexity}).fill(0).map(() => Math.random().toString(36).charAt(2)).join('')
        : password
    );

    const keyInfos: { address: string, id: string}[] = []
    const printKeyInfo: PrintKeyInfo[] = []
    const currentDir = process.cwd();

    for (let i = 0; i < this.NAMES.length; i++) {
      const name = this.NAMES[i];
      const password = passwords[i];
      const file = `${currentDir}/${args.prefix}-${name}.p12`;
      // console.log(`Generating key: ${file} with alias: ${alias} and password: ${password}`);
      // eslint-disable-next-line no-await-in-loop
      keyInfos[i] = await keyFileHelper.getKeyInfoFromParams({ CL_KEYALIAS: alias, CL_KEYSTORE: file, CL_PASSWORD: password});
      // await this.spawnCommand('cpilot', ['keygen', '--alias', `${alias}-${name}`, '--password', password, '--output', keyName]);
      printKeyInfo[i] = {
        "name": `${args.prefix}-${name}`,
        "key_file": {
          "name": `${args.prefix}-${name}.p12`,
          alias,
          password
        }
      }
      console.log('generated:', file);
    }

    const fees = {
      "snapshot_fees": {
        "owner": {
          "key_file": printKeyInfo[3].key_file
        },
        "staking": {
          "key_file": printKeyInfo[4].key_file,
        }
      }
    };

    // Show euclid.json "nodes" JSON array
    console.log(JSON.stringify({"nodes": printKeyInfo.slice(0,3)}, null, 2));

    // Show euclid.json snapshot_fees and staking object
    console.log(JSON.stringify(fees, null, 2));

    // Show each name and Node ID
    for (const [i, kInfo] of keyInfos.entries()) console.log(`\n${args.prefix}-${this.NAMES[i]}\n${kInfo.address}\n${kInfo.id}`);

  }
}

type PrintKeyInfo = {
  "key_file": {
    "alias": string,
    "name": string,
    "password": string
  }
  "name": string,
};