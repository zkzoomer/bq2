import { generateGradeClaimProof, verifyGradeClaimProof, N_LEVELS, Poseidon, buildPoseidon, FullGradeCommitment, TestGradingVariables, GradeClaimFullProof } from "@bq-core/lib"
import { formatBytes32String } from "@ethersproject/strings"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'
import { getCurveFromName } from "ffjavascript"

chai.use(chaiAsPromised)

describe("Grade Claim", () => {
    let poseidon: Poseidon

    const gradeThreshold = 80
    const externalNullifier = formatBytes32String("Topic")
    const signal = formatBytes32String("Hello world")

    const snarkArtifacts = {
        wasmFilePath: './snark-artifacts/gradeClaim.wasm',
        zkeyFilePath: `./snark-artifacts/gradeClaim.zkey`
    }

    let gradeGroup: Group

    const identity = new Identity()

    const testGradingVariables: TestGradingVariables = {
        multipleChoiceWeight: 40,
        nQuestions: 10
    }
    const grade = testGradingVariables.multipleChoiceWeight + 
        Math.floor((100 - testGradingVariables.multipleChoiceWeight) * 
        (testGradingVariables.nQuestions - 1) / testGradingVariables.nQuestions)
    const weightedGrade = grade * testGradingVariables.nQuestions
    let gradeCommitment: FullGradeCommitment

    let fullProof: GradeClaimFullProof
    let curve: any

    const expect = chai.expect

    before(async () => {
        poseidon = await buildPoseidon();

        gradeGroup = new Group(0, N_LEVELS)

        const gradeCommitmentValue = poseidon([poseidon([identity.nullifier, identity.trapdoor]), weightedGrade])
        gradeGroup.addMembers([BigInt(1), BigInt(2), gradeCommitmentValue])

        gradeCommitment = {
            gradeCommitmentValue,
            gradeCommitmentIndex: 2,
            weightedGrade,
            grade
        }

        curve = await getCurveFromName("bn128")
    })

    after(async () => {
        await curve.terminate()
    })

    describe("generateCredentialOwnershipProof", () => {
        it("Should not generate the grade claim proof if the grade commitment is not part of the group", async () => {
            const gradeGroup = new Group(0, N_LEVELS)

            await expect(
                generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, gradeCommitment, snarkArtifacts)
            ).to.be.rejectedWith("The leaf does not exist in this tree")

            await expect(
                generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, testGradingVariables, snarkArtifacts)
            ).to.be.rejectedWith("The user did not obtain a grade for this test")
        })

        it("Should not generate a grade claim proof with default snark artifacts with Node.js", async () => {
            await expect(
                generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, gradeCommitment)
            ).to.be.rejectedWith("SNARK artifacts need to be provided")
        })

        it("Should generate a grade claim proof passing a group as parameter", async () => {
            fullProof = await generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, gradeCommitment, snarkArtifacts)
            expect(fullProof.gradeTreeRoot).to.be.equal(gradeGroup.root.toString())
        
            fullProof = await generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, testGradingVariables, snarkArtifacts)
            expect(fullProof.gradeTreeRoot).to.be.equal(gradeGroup.root.toString())
        })

        it("Should generate a grade claim proof passing a Merkle proof as parameter", async () => {
            fullProof = await generateGradeClaimProof(identity, gradeGroup.generateMerkleProof(2), gradeThreshold, externalNullifier, signal, gradeCommitment, snarkArtifacts)
            expect(fullProof.gradeTreeRoot).to.be.equal(gradeGroup.root.toString())
        })

        it("Should revert when passing a Merkle proof and the test grading variables", async () => {
            await expect(
                generateGradeClaimProof(identity, gradeGroup.generateMerkleProof(2), gradeThreshold, externalNullifier, signal, testGradingVariables, snarkArtifacts)
            ).to.be.rejectedWith("Need to provide the FullGradeCommitment when providing a Merkle proof")
        })
    })

    describe("verifyGradeClaimProof", () => {
        it("Should verify a grade claim proof", async () => {
            const response = await verifyGradeClaimProof(fullProof)

            expect(response).to.be.true
        })
    })
})
