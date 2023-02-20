import { TestAnswers, TestFullProof, TestVariables, SnarkArtifacts, N_LEVELS } from "@bq2/lib"
import { Group, Member } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { groth16 } from "snarkjs"
import { packProof } from "../helpers"

/**
 * Generates a proof of knowledge of a solution to a Block Qualified test
 * @param identity The Semaphore identity that will be associated with the solution.
 * @param testAnswers: The answers that the user provided for this test, comprised of the multiple choice and open answers.
 * @param testVariables: The variables that define the test and its grading.
 * @param identityGroup The Semaphore group or its Merkle proof for the corresponding identity group. When providing a passing solution, this group is the credentials group. Otherwise, it is the no credentials group.
 * @param gradeGroup The Semaphore group or its Merkle proof for the grade group.
 * @param testId The ID of the test being solved, used to compute the zero leaf of the Merkle trees.
 * @param snarkArtifacts The SNARK artifacts.
 * @returns The test solution proof ready to be verified.
 */
export default async function generateTestProof(
    { trapdoor, nullifier }: Identity,
    { multipleChoiceAnswers, openAnswers }: TestAnswers,
    { minimumGrade, multipleChoiceWeight, nQuestions, multipleChoiceRoot, openAnswersHashesRoot, openAnswersHashes }: TestVariables,
    identityGroup: Group | MerkleProof,
    gradeGroup: Group | MerkleProof,
    snarkArtifacts?: SnarkArtifacts,
    testId?: number
): Promise<TestFullProof> {
    let identityMerkleProof: MerkleProof
    let gradeMerkleProof: MerkleProof
    let emptyLeaf: Member

    if ("depth" in identityGroup) {
        emptyLeaf = identityGroup.zeroValue
        identityGroup.addMember(emptyLeaf)
        identityMerkleProof = identityGroup.generateMerkleProof(identityGroup.members.length - 1)
    } else {
        if (testId === undefined) {
            throw new Error("The test ID was not provided")
        }
        emptyLeaf = (new Group(testId, N_LEVELS)).root
        identityMerkleProof = identityGroup
    }

    if ("depth" in gradeGroup) {
        emptyLeaf = gradeGroup.zeroValue
        gradeGroup.addMember(gradeGroup.zeroValue)
        gradeMerkleProof = gradeGroup.generateMerkleProof(gradeGroup.members.length - 1)
    } else {
        if (testId === undefined) {
            throw new Error("The test ID was not provided")
        }
        emptyLeaf = (new Group(testId, N_LEVELS)).root
        gradeMerkleProof = gradeGroup
    }

    if (!snarkArtifacts) {
        throw new Error("SNARK artifacts need to be provided")
        /* snarkArtifacts = {
            wasmFilePath: ``,
            zkeyFilePath: ``
        } */
    }

    const { proof, publicSignals } = await groth16.fullProve(
        {
            minimumGrade,
            multipleChoiceWeight,
            nQuestions,
            multipleChoiceAnswers,
            multipleChoiceRoot,
            openAnswers,
            openAnswersHashes,
            openAnswersHashesRoot,
            identityNullifier: nullifier,
            identityTrapdoor: trapdoor,
            identityTreeEmptyLeaf: emptyLeaf,
            identityTreePathIndices: identityMerkleProof.pathIndices,
            identityTreeSiblings: identityMerkleProof.siblings,
            gradeTreeEmptyLeaf: emptyLeaf,
            gradeTreePathIndices: gradeMerkleProof.pathIndices,
            gradeTreeSiblings: gradeMerkleProof.siblings
        },
        snarkArtifacts.wasmFilePath,
        snarkArtifacts.zkeyFilePath
    )

    return {
        identityCommitment: publicSignals[1],
        newIdentityTreeRoot: publicSignals[3],
        gradeCommitment: publicSignals[5],
        newGradeTreeRoot: publicSignals[7],
        publicSignals,
        proof: packProof(proof)
    }
}
