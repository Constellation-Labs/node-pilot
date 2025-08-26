import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('config:set', () => {
  it('runs config:set cmd', async () => {
    const {stdout} = await runCommand('config:set')
    expect(stdout).to.contain('hello world')
  })

  it('runs config:set --name oclif', async () => {
    const {stdout} = await runCommand('config:set --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
