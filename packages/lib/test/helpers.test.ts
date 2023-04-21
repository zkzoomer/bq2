import { 
    buildPoseidon, 
    getGradeCommitment, 
    generateCredentialOwnershipProof, 
    generateMultipleChoiceAnswers,
    generateOpenAnswers, 
    hash, 
    packProof,
    unpackProof,
    Poseidon, 
    MAX_TREE_DEPTH
} from "@bq-core/lib"
import { formatBytes32String } from "@ethersproject/strings"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { FullProof } from "@semaphore-protocol/proof"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'
import { getCurveFromName } from "ffjavascript"

chai.use(chaiAsPromised)

const TEST_HEIGHT = 4;

describe("Helper functions", () => {
    let poseidon: Poseidon 

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
        poseidon = await buildPoseidon();

        curve = await getCurveFromName("bn128")

        const group = new Group(0, MAX_TREE_DEPTH)
        group.addMembers([BigInt(1), BigInt(2), identity.commitment])

        fullProof = await generateCredentialOwnershipProof(identity, group, externalNullifier, signal, snarkArtifacts) as FullProof
    })

    after(async () => {
        await curve.terminate()
    })

    describe("hash", () => {
        it("Should hash the signal value correctly", async () => {
            const signalHash = hash(signal)

            expect(signalHash).to.be.equal(
                "8665846418922331996225934941481656421248110469944536651334918563951783029"
            )
        })

        it("Should hash the external nullifier value correctly", async () => {
            const externalNullifierHash = hash(externalNullifier)

            expect(externalNullifierHash).to.be.equal(
                "244178201824278269437519042830883072613014992408751798420801126401127326826"
            )
        })

        it("Should hash a number", async () => {
            expect(hash(2)).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash a big number", async () => {
            expect(hash(BigInt(2))).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash an hex number", async () => {
            expect(hash("0x2")).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        it("Should hash an string number", async () => {
            expect(hash("2")).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        })

        /* it("Should hash an array", async () => {
            expect(hash([2])).to.be.equal(
                "113682330006535319932160121224458771213356533826860247409332700812532759386"
            )
        }) */
    })

    describe("packProof and unpackProof", () => {
        it("Should return a packed proof", async () => {
            fullProof.proof
            const originalProof = unpackProof(fullProof.proof)
            const proof = packProof(originalProof)

            expect(proof).to.deep.equal(fullProof.proof)
        })
    })

    describe("generateMultipleChoiceAnswers", () => {
        it("Throws when giving it more answers than supported", () => {
            expect(
                () => generateMultipleChoiceAnswers(Array(2 ** TEST_HEIGHT + 1).fill(1), TEST_HEIGHT)
            ).to.throw("More answers were given than supported")
        })

        it("Fills up an incomplete multiple choice answers array", () => {
            const fullOpenAnswers = generateMultipleChoiceAnswers([1], TEST_HEIGHT)
            const expectedMultipleChoiceAnswers = Array(2 ** TEST_HEIGHT).fill('0')
            expectedMultipleChoiceAnswers[0] = '1'

            expect(fullOpenAnswers).to.deep.equal(expectedMultipleChoiceAnswers)
        })

        it("Joins together multiple answer responses into a single number", () => {
            const fullOpenAnswers = generateMultipleChoiceAnswers([[1,2,3]], TEST_HEIGHT)
            const expectedMultipleChoiceAnswers = Array(2 ** TEST_HEIGHT).fill('0')
            expectedMultipleChoiceAnswers[0] = '123'

            expect(fullOpenAnswers).to.deep.equal(expectedMultipleChoiceAnswers)
        })

        it("Correctly orders multiple answer responses into a single number", () => {
            const fullOpenAnswers = generateMultipleChoiceAnswers([[7,8,4]], TEST_HEIGHT)
            const expectedMultipleChoiceAnswers = Array(2 ** TEST_HEIGHT).fill('0')
            expectedMultipleChoiceAnswers[0] = '478'

            expect(fullOpenAnswers).to.deep.equal(expectedMultipleChoiceAnswers)
        })
    })

    describe("generateOpenAnswers", () => {
        it("Throws when giving it more answers than supported", () => {
            expect(
                () => generateOpenAnswers(Array(2 ** TEST_HEIGHT + 1).fill('deenz'), TEST_HEIGHT)
            ).to.throw("More answers were given than supported")
        })

        it("Fills up an incomplete open answers array", () => {
            const fullOpenAnswers = generateOpenAnswers(['deenz'], TEST_HEIGHT)
            const expectedOpenAnswers = Array(2 ** TEST_HEIGHT).fill(hash(""))
            expectedOpenAnswers[0] =hash("deenz")

            expect(fullOpenAnswers).to.deep.equal(expectedOpenAnswers)
        })
    })

    describe("getGradeCommitment", () => {
        const multipleChoiceWeight = 40;
        const nQuestions = 10;
        
        it("Throws when the user does not have a grade commitment", async () => {
            const gradeGroup = new Group(0, MAX_TREE_DEPTH)

            gradeGroup.addMembers([BigInt(1), BigInt(2)])
            
            await expect(
                getGradeCommitment(identity, gradeGroup, multipleChoiceWeight, nQuestions)
            ).to.be.rejectedWith("The user did not obtain a grade for this test")
        })

        it("Gets the correct grade commitment from a tree", async () => {
            const gradeGroup = new Group(0, MAX_TREE_DEPTH)
    
            const grade = multipleChoiceWeight + Math.floor((100 - multipleChoiceWeight) * (nQuestions - 1) / nQuestions)
            const _gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), grade])
    
            gradeGroup.addMembers([BigInt(1), BigInt(2), _gradeCommitment])
    
            const gradeCommitment = await getGradeCommitment(identity, gradeGroup, multipleChoiceWeight, nQuestions)
    
            expect(gradeCommitment).to.deep.equal({
                gradeCommitmentValue: _gradeCommitment,
                gradeCommitmentIndex: gradeGroup.indexOf(_gradeCommitment),
                grade
            })
        })
    })
})