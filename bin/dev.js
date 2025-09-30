#!/usr/bin/env -S node --loader ts-node/esm --disable-warning=ExperimentalWarning --disable-warning=DeprecationWarning
const skipDefaultCommand = {
    '--help': true, '--version': true, '-h': true, '-v': true,
}
if (process.argv.length === 2) {
    process.argv[2] = 'status';
}
else if (process.argv.length > 2 && process.argv.every(a => a.startsWith('-')) && !skipDefaultCommand[process.argv[2]]) {
    process.argv.splice(2, 0 , 'status');
}

import {execute} from '@oclif/core'

await execute({development: true, dir: import.meta.url})
