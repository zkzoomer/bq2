import { generateCredentialOwnershipProof, verifyCredentialOwnershipProof, N_LEVELS } from "@bq-core/proof"
import { FullProof } from "@semaphore-protocol/proof"
import { formatBytes32String } from "@ethersproject/strings"
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
        wasmFilePath: './snark-artifacts/semaphore.wasm',
        zkeyFilePath: `./snark-artifacts/semaphore.zkey`
    }

    const identity = new Identity()

    let fullProof: FullProof
    let fullProofs: FullProof[]
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
            const group = new Group(0, N_LEVELS)

            group.addMembers([BigInt(1), BigInt(2)])
            
            await expect(
                generateCredentialOwnershipProof(identity, group, externalNullifier, signal, snarkArtifacts)
            ).to.be.rejectedWith(Error, "The identity is not part of the group");
        })

        it("Should not generate a Semaphore proof with default snark artifacts with Node.js", async () => {
            const group = new Group(0, N_LEVELS)

            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            await expect(
                generateCredentialOwnershipProof(identity, group, externalNullifier, signal)
            ).to.be.rejectedWith("ENOENT: no such file or directory")
        })

        it("Should generate one or several Semaphore proofs passing a group or groups as parameter", async () => {
            const group = new Group(0, N_LEVELS)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            fullProof = await generateCredentialOwnershipProof(identity, group, externalNullifier, signal, snarkArtifacts) as FullProof
            expect(fullProof.merkleTreeRoot).to.be.equal(group.root.toString())

            const altGroup = new Group(0, N_LEVELS)
            altGroup.addMembers([BigInt(1), identity.commitment])

            fullProofs = await generateCredentialOwnershipProof(identity, [group, altGroup], externalNullifier, signal, snarkArtifacts) as FullProof[]
            expect(fullProofs[0].merkleTreeRoot).to.be.equal(group.root.toString())
            expect(fullProofs[1].merkleTreeRoot).to.be.equal(altGroup.root.toString())
        })

        it("Should generate one or several Semaphore proofs passing a Merkle proof or proofs as parameter", async () => {
            const group = new Group(0, N_LEVELS)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            fullProof = await generateCredentialOwnershipProof(identity, group.generateMerkleProof(2), externalNullifier, signal, snarkArtifacts) as FullProof
            expect(fullProof.merkleTreeRoot).to.be.equal(group.root.toString())

            const altGroup = new Group(0, N_LEVELS)
            altGroup.addMembers([BigInt(1), identity.commitment])

            fullProofs = await generateCredentialOwnershipProof(identity, [group.generateMerkleProof(2), altGroup.generateMerkleProof(1)], externalNullifier, signal, snarkArtifacts) as FullProof[]
            expect(fullProofs[0].merkleTreeRoot).to.be.equal(group.root.toString())
            expect(fullProofs[1].merkleTreeRoot).to.be.equal(altGroup.root.toString())
        })

        it("Should generate several Semaphore proofs passing groups or Merkle proofs as parameters", async () => {
            const group = new Group(0, N_LEVELS)
            group.addMembers([BigInt(1), BigInt(2), identity.commitment])

            const altGroup = new Group(0, N_LEVELS)
            altGroup.addMembers([BigInt(1), identity.commitment])

            fullProofs = await generateCredentialOwnershipProof(identity, [group.generateMerkleProof(2), altGroup], externalNullifier, signal, snarkArtifacts) as FullProof[]
            expect(fullProofs[0].merkleTreeRoot).to.be.equal(group.root.toString())
            expect(fullProofs[1].merkleTreeRoot).to.be.equal(altGroup.root.toString())
        })
    })

    describe("verifyCredentialOwnershipProof", () => {
        it("Should verify a Semaphore proof", async () => {
            const response = await verifyCredentialOwnershipProof(fullProof)

            expect(response).to.be.true
        })

        it("Should verify several Semaphore proofs", async () => {
            const response = await verifyCredentialOwnershipProof(fullProofs)

            expect(response).to.deep.equal([true, true])
        })
    })
})
