import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('info', () => {
  it('runs info cmd', async () => {
    const {stdout} = await runCommand('info')
    expect(stdout).to.contain('hello world')
  })

  it('runs info --name oclif', async () => {
    const {stdout} = await runCommand('info --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
