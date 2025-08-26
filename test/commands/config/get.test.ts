import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('config:get', () => {
  it('runs config:get cmd', async () => {
    const {stdout} = await runCommand('config:get')
    expect(stdout).to.contain('hello world')
  })

  it('runs config:get --name oclif', async () => {
    const {stdout} = await runCommand('config:get --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
