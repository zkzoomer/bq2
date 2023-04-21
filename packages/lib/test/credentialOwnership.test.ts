import { generateCredentialOwnershipProof, verifyCredentialOwnershipProof, MAX_TREE_DEPTH } from "@bq-core/lib"
import { formatBytes32String } from "@ethersproject/strings"
import { FullProof } from "@semaphore-protocol/proof"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'
import { getCurveFromName } from "ffjavascript"

chai.use(chaiAsPromised)

describe("Credential Ownership", () => {
    const externalNullifier = formatBytes32String("Topic")
    const signal = formatBytes32String("Hello world")

    const snarkArtifacts = {
        wasmFilePath: '../snark-artifacts/semaphore.wasm',
        zkeyFilePath: `../snark-artifacts/semaphore.zkey`
    }

    const identity = new Identity()

    let fullProof: FullProof
    let curve: any

    const expect = chai.expect

    before(async () => {
        curve = await getCurveFromName("bn128")
    })

    after(async () => {
        await curve.terminate()
    })
   
    describe("generateCredentialOwnershipProof", () => {
        it("Should not generate the Semaphore proof if the identity is not part of the group", async () => {
            const group = new Group(0, MAX_TREE_DEPTH)

            group.addMembers([BigInt(1), BigInt(2)])
            
            await expect(
                generateCredentialOwnershipProof(identity, group, externalNullifier, signal, snarkArtifacts)
            ).to.be.rejectedWith(Error, "The identity is not part of the group");
        })

        it("Should not generate a Semaphore proof with default snark artifacts with Node.js", async () => {
            const group = new Group(0, MAX_TREE_DEPTH)

            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            await expect(
                generateCredentialOwnershipProof(identity, group, externalNullifier, signal)
            ).to.be.rejectedWith("ENOENT: no such file or directory")
        })

        it("Should generate a Semaphore proof passing a group as parameter", async () => {
            const group = new Group(0, MAX_TREE_DEPTH)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            fullProof = await generateCredentialOwnershipProof(identity, group, externalNullifier, signal, snarkArtifacts)
            expect(fullProof.merkleTreeRoot).to.be.equal(group.root.toString())
        })

        it("Should generate a Semaphore proof passing a Merkle proof as parameter", async () => {
            const group = new Group(0, MAX_TREE_DEPTH)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            fullProof = await generateCredentialOwnershipProof(identity, group.generateMerkleProof(2), externalNullifier, signal, snarkArtifacts)
            expect(fullProof.merkleTreeRoot).to.be.equal(group.root.toString())
        })
    })

    describe("verifyCredentialOwnershipProof", () => {
        it("Should verify a Semaphore proof", async () => {
            const response = await verifyCredentialOwnershipProof(fullProof)

            expect(response).to.be.true
        })
    })
})
