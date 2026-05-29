import {expect} from 'chai'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sinon from 'sinon'

import {checkNetwork} from '../../src/checks/check-network.js'
import {clm} from '../../src/clm.js'
import {configStore} from '../../src/config-store.js'
import {NetworkType} from '../../src/config-store.js'

// real node id from the integrationnet seed-list bug report
const NODE_ID = 'de51af87c1ac6bd06e428009b7f34dd3b76c5799ff44b8924b8630fc6ed28eb7c148e1c538c29a136a5bc946d528cf51fc48b6256eecdb3bfdf71ed3f6c0f8d7'
const OTHER_ID = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888'

// sentinel so we can assert the "not found" path without calling process.exit
class SeedListError extends Error {}

describe('checkNetwork.checkSeedList', () => {
    let projectDir: string
    let seedListFile: string
    let fetchStub: sinon.SinonStub
    let errorStub: sinon.SinonStub
    let postStepStub: sinon.SinonStub
    let warnStub: sinon.SinonStub

    function stubConfig(type: NetworkType) {
        sinon.stub(configStore, 'getNetworkInfo').returns({supportedTypes: [type], type, version: 'latest'})
        sinon.stub(configStore, 'getProjectInfo').returns({nodeId: NODE_ID, projectDir} as ReturnType<typeof configStore.getProjectInfo>)
    }

    function mockFetch(body: string) {
        fetchStub.resolves({ok: true, text: async () => body} as Response)
    }

    beforeEach(() => {
        projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpilot-seedlist-'))
        seedListFile = path.join(projectDir, 'seedlist')

        fetchStub = sinon.stub(globalThis, 'fetch')
        sinon.stub(clm, 'preStep')
        postStepStub = sinon.stub(clm, 'postStep')
        warnStub = sinon.stub(clm, 'warn')
        errorStub = sinon.stub(clm, 'error').throws(new SeedListError())
    })

    afterEach(() => {
        sinon.restore()
        fs.rmSync(projectDir, {force: true, recursive: true})
    })

    it('passes and refreshes the local seedlist when the remote list contains the node id', async () => {
        stubConfig('integrationnet')
        const remote = `${OTHER_ID}\n${NODE_ID}\n`
        mockFetch(remote)

        await checkNetwork.checkSeedList()

        expect(errorStub.called, 'should not error').to.equal(false)
        expect(postStepStub.calledWithMatch(/found/i)).to.equal(true)
        expect(fs.readFileSync(seedListFile, 'utf8')).to.equal(remote)
    })

    it('errors when the node id is not in the remote list (the reported bug)', async () => {
        stubConfig('integrationnet')
        mockFetch(`${OTHER_ID}\n`)

        try {
            await checkNetwork.checkSeedList()
            expect.fail('expected checkSeedList to error out')
        } catch (error) {
            expect(error).to.be.instanceOf(SeedListError)
        }

        expect(errorStub.called, 'should report not-found').to.equal(true)
        expect(fs.existsSync(seedListFile), 'must not write seedlist on miss').to.equal(false)
    })

    it('re-validates every run instead of trusting a cached flag', async () => {
        // even if a prior "checked" flag were set, the remote must still be consulted
        sinon.stub(configStore, 'hasProjectFlag').returns(true)
        stubConfig('integrationnet')
        mockFetch(`${NODE_ID}\n`)

        await checkNetwork.checkSeedList()

        expect(fetchStub.calledOnce, 'remote list must be fetched').to.equal(true)
    })

    it('falls back to the local seedlist when the remote is unreachable', async () => {
        stubConfig('integrationnet')
        fs.writeFileSync(seedListFile, `${NODE_ID}\n`)
        fetchStub.rejects(new Error('network down'))

        await checkNetwork.checkSeedList()

        expect(errorStub.called, 'should not error on fallback hit').to.equal(false)
        expect(warnStub.calledWithMatch(/fall(ing)? back/i)).to.equal(true)
        expect(postStepStub.calledWithMatch(/found/i)).to.equal(true)
    })

    it('errors when the remote is unreachable and the local list misses', async () => {
        stubConfig('integrationnet')
        fs.writeFileSync(seedListFile, `${OTHER_ID}\n`)
        fetchStub.rejects(new Error('network down'))

        try {
            await checkNetwork.checkSeedList()
            expect.fail('expected checkSeedList to error out')
        } catch (error) {
            expect(error).to.be.instanceOf(SeedListError)
        }

        expect(errorStub.called).to.equal(true)
    })

    it('validates mainnet against the local release seedlist without fetching', async () => {
        stubConfig('mainnet')
        fs.writeFileSync(seedListFile, `${NODE_ID}\n`)

        await checkNetwork.checkSeedList()

        expect(fetchStub.called, 'mainnet must not hit S3').to.equal(false)
        expect(errorStub.called).to.equal(false)
        expect(postStepStub.calledWithMatch(/found/i)).to.equal(true)
    })
})
