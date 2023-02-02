import { Group, Member } from "@semaphore-protocol/group"
import type { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { groth16 } from "snarkjs"
import { TestFullProof, SnarkArtifacts, TestAnswers, TestVariables } from "./types"
import { packProof } from "./helpers/packProof"

export default async function generateTestProof(
    { trapdoor, nullifier }: Identity,
    { multipleChoiceAnswers, openAnswers }: TestAnswers,
    { minimumGrade, multipleChoiceWeight, nQuestions, multipleChoiceRoot, openAnswersHashesRoot, openAnswersHashes }: TestVariables,
    identityGroup: Group,
    gradeGroup: Group,
    snarkArtifacts: SnarkArtifacts,
    /* snarkArtifacts?: SnarkArtifacts */
): Promise<TestFullProof> {
    let identityMerkleProof: MerkleProof
    let gradeMerkleProof: MerkleProof
    let emptyLeaf: Member

    if ("depth" in identityGroup) {
        emptyLeaf = identityGroup.zeroValue
        identityGroup.addMember(emptyLeaf)
        identityMerkleProof = identityGroup.generateMerkleProof(identityGroup.members.length - 1)
    } else {
        identityMerkleProof = identityGroup
    }

    if ("depth" in gradeGroup) {
        emptyLeaf = gradeGroup.zeroValue
        gradeGroup.addMember(gradeGroup.zeroValue)
        gradeMerkleProof = gradeGroup.generateMerkleProof(gradeGroup.members.length - 1)
    } else {
        gradeMerkleProof = gradeGroup
    }

    /* if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: ``,
            zkeyFilePath: ``
        }
    } */

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
            identityTreeEmptyLeaf: identityGroup.zeroValue,
            identityTreePathIndices: identityMerkleProof.pathIndices,
            identityTreeSiblings: identityMerkleProof.siblings,
            gradeTreeEmptyLeaf: gradeGroup.zeroValue,
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
