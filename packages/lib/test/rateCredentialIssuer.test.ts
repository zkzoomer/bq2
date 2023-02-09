import { generateRateCredentialIssuerProof, N_LEVELS, Poseidon, buildPoseidon, hash } from "@bq-core/lib"
import { formatBytes32String } from "@ethersproject/strings"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { FullProof, verifyProof } from "@semaphore-protocol/proof"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'
import { getCurveFromName } from "ffjavascript"

chai.use(chaiAsPromised)

describe("Grade Claim", () => {
    let poseidon: Poseidon

    const rate = 35
    const externalNullifier = formatBytes32String("bq-rate")

    const snarkArtifacts = {
        wasmFilePath: './snark-artifacts/semaphore.wasm',
        zkeyFilePath: `./snark-artifacts/semaphore.zkey`
    }

    const identity = new Identity()

    let fullProof: FullProof
    let curve: any

    const expect = chai.expect

    before(async () => {
        poseidon = await buildPoseidon()

        curve = await getCurveFromName("bn128")
    })

    after(async () => {
        await curve.terminate()
    })

    describe("rateCredentialIssuer", () => {
        it("Should revert when giving it invalid rating values", async () => {
            const group = new Group(0, N_LEVELS)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            await expect(
                generateRateCredentialIssuerProof(identity, group, 101, snarkArtifacts)
            ).to.be.rejectedWith("Rating value is not supported")
        })

        it("Should generate the Semaphore proof with the rating as signal", async () => {
            const group = new Group(0, N_LEVELS)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            const expectedNullifierHash = poseidon([hash(externalNullifier), identity.nullifier])

            fullProof = await generateRateCredentialIssuerProof(identity, group, rate, snarkArtifacts)

            expect(fullProof.signal).to.be.equal(rate.toString())
            expect(fullProof.nullifierHash).to.be.equal(expectedNullifierHash.toString())
        })
    })

    describe("Verifying a credential rating", () => {
        it("Should verify the Semaphore proof", async () => {
            const response = await verifyProof(fullProof, N_LEVELS)

            expect(response).to.be.true
        })
    })
})
