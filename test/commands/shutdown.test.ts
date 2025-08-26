import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('shutdown', () => {
  it('runs shutdown cmd', async () => {
    const {stdout} = await runCommand('shutdown')
    expect(stdout).to.contain('hello world')
  })

  it('runs shutdown --name oclif', async () => {
    const {stdout} = await runCommand('shutdown --name oclif')
    expect(stdout).to.contain('hello oclif')
  })
})
