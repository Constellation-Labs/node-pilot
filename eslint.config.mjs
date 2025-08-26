import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

// export default [includeIgnoreFile(gitignorePath), ...oclif, prettier]

export default [
    includeIgnoreFile(gitignorePath),
    ...oclif,
    prettier,
    {
        rules: {
            'n/no-process-exit': 'off',
            // 'max-params': 5,
            'unicorn/import-style': 'off',
            'unicorn/no-process-exit': 'off',
        }
    }
    // {
    //     rules: {
    //         'perfectionist/sort-objects': 'off',
    //     },
    // },
]