import { buildPoseidon, generateCredentialOwnershipProof, generateOpenAnswers, getGradeCommitment, hash, N_LEVELS, Poseidon, TEST_HEIGHT } from "@bq-core/lib"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { FullProof } from "@semaphore-protocol/proof"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'
import { getCurveFromName } from "ffjavascript"
import packProof from "../src/helpers/packProof"
import unpackProof from "../src/helpers/unpackProof"

chai.use(chaiAsPromised)

describe("Helper functions", () => {
    let poseidon: Poseidon 

    const externalNullifier = "Topic"
    const signal = "Hello world"

    const snarkArtifacts = {
        wasmFilePath: './snark-artifacts/semaphore.wasm',
        zkeyFilePath: `./snark-artifacts/semaphore.zkey`
    }

    const identity = new Identity()

    let fullProof: FullProof
    let curve: any

    const expect = chai.expect

    before(async () => {
        poseidon = await buildPoseidon();

        curve = await getCurveFromName("bn128")

        const group = new Group(0, N_LEVELS)
        group.addMembers([BigInt(1), BigInt(2), identity.commitment])

        fullProof = await generateCredentialOwnershipProof(identity, group, externalNullifier, signal, snarkArtifacts) as FullProof
    })

    after(async () => {
        await curve.terminate()
    })

    describe("hash", () => {
        it("Should hash the signal value correctly", async () => {
            const signalHash = hash(signal)

            expect(signalHash.toString()).to.be.equal(
                "8665846418922331996225934941481656421248110469944536651334918563951783029"
            )
        })

        it("Should hash the external nullifier value correctly", async () => {
            const externalNullifierHash = hash(externalNullifier)

            expect(externalNullifierHash.toString()).to.be.equal(
                "244178201824278269437519042830883072613014992408751798420801126401127326826"
            )
        })

        it("Should hash a number", async () => {
            expect(hash(2).toString()).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash a big number", async () => {
            expect(hash(BigInt(2)).toString()).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash an hex number", async () => {
            expect(hash("0x2").toString()).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash an string number", async () => {
            expect(hash("2").toString()).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash an array", async () => {
            expect(hash([2]).toString()).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })
    })

    describe("packProof and unpackProof", () => {
        it("Should return a packed proof", async () => {
            fullProof.proof
            const originalProof = unpackProof(fullProof.proof)
            const proof = packProof(originalProof)

            expect(proof).to.deep.equal(fullProof.proof)
        })
    })

    describe("generateOpenAnswers", () => {
        it("Throws when giving it more answers than supported", () => {
            expect(
                () => generateOpenAnswers(Array(2 ** TEST_HEIGHT + 1).fill('deenz'))
            ).to.throw("More answers were given than supported")
        })

        it("Fills up an incomplete open answers array", () => {
            const fullOpenAnswers = generateOpenAnswers(['deenz'])
            const expectedOpenAnswers = Array(2 ** TEST_HEIGHT).fill(hash(""))
            expectedOpenAnswers[0] =hash("deenz")

            expect(fullOpenAnswers).to.deep.equal(expectedOpenAnswers)
        })
    })

    describe("getGradeCommitment", () => {
        const multipleChoiceWeight = 40;
        const nQuestions = 10;
        
        it("Throws when the user does not have a grade commitment", async () => {
            const gradeGroup = new Group(0, N_LEVELS)

            gradeGroup.addMembers([BigInt(1), BigInt(2)])
            
            await expect(
                getGradeCommitment(identity, gradeGroup, multipleChoiceWeight, nQuestions)
            ).to.be.rejectedWith("The user did not obtain a grade for this test")
        })

        it("Gets the correct grade commitment from a tree", async () => {
            const gradeGroup = new Group(0, N_LEVELS)
    
            const weightedGrade = multipleChoiceWeight * nQuestions + (100 - multipleChoiceWeight) * (nQuestions - 1)
            const _gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), weightedGrade])
    
            gradeGroup.addMembers([BigInt(1), BigInt(2), _gradeCommitment])
    
            const gradeCommitment = await getGradeCommitment(identity, gradeGroup, multipleChoiceWeight, nQuestions)
    
            expect(gradeCommitment).to.deep.equal({
                gradeCommitmentValue: _gradeCommitment,
                gradeCommitmentIndex: gradeGroup.indexOf(_gradeCommitment),
                weightedGrade,
                grade: Math.floor(weightedGrade / nQuestions)
            })
        })
    })
})