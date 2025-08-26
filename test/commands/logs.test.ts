import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('logs', () => {
  it('runs logs cmd', async () => {
    const {stdout} = await runCommand('logs')
    expect(stdout).to.contain('hello world')
  })

  it('runs logs --name oclif', async () => {
    const {stdout} = await runCommand('logs --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
