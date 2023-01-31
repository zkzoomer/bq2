import { Group } from "@semaphore-protocol/group"
import type { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { groth16 } from "snarkjs"
import { TestFullProof, SnarkArtifacts, TestAnswers, TestParameters } from "./types"
import { packProof } from "./helpers/packProof"
import { ZERO_LEAF } from "./constants"

export default async function generateTestProof(
    { trapdoor, nullifier }: Identity,
    { multipleChoiceAnswers, openAnswers }: TestAnswers,
    { minimumGrade, multipleChoiceWeight, nQuestions, solutionHash, openAnswersHashes, openAnswersHashesRoot }: TestParameters,
    identityGroupOrMerkleProof: Group | MerkleProof,
    gradeGroupOrMerkleProof: Group | MerkleProof,
    snarkArtifacts: SnarkArtifacts
    /* snarkArtifacts?: SnarkArtifacts */
): Promise<TestFullProof> {
    let identityMerkleProof: MerkleProof
    let gradeMerkleProof: MerkleProof

    if ("depth" in identityGroupOrMerkleProof) {
        identityGroupOrMerkleProof.addMember(ZERO_LEAF)
        identityMerkleProof = identityGroupOrMerkleProof.generateMerkleProof(identityGroupOrMerkleProof.members.length - 1)
    } else {
        identityMerkleProof = identityGroupOrMerkleProof
    }

    if ("depth" in gradeGroupOrMerkleProof) {
        gradeGroupOrMerkleProof.addMember(ZERO_LEAF)
        gradeMerkleProof = gradeGroupOrMerkleProof.generateMerkleProof(gradeGroupOrMerkleProof.members.length - 1)
    } else {
        gradeMerkleProof = gradeGroupOrMerkleProof
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
            solutionHash,
            openAnswers,
            openAnswersHashes,
            openAnswersHashesRoot,
            identityNullifier: nullifier,
            identityTrapdoor: trapdoor,
            identityTreeEmptyLeaf: ZERO_LEAF,
            identityTreePathIndices: identityMerkleProof.pathIndices,
            identityTreeSiblings: identityMerkleProof.siblings,
            gradeTreeEmptyLeaf: ZERO_LEAF,
            gradeTreePathIndices: gradeMerkleProof.pathIndices,
            gradeTreeSiblings: gradeMerkleProof.siblings
        },
        snarkArtifacts.wasmFilePath,
        snarkArtifacts.zkeyFilePath
    )

    return {
        identityCommitmentIndex: publicSignals[0],
        identityCommitment: publicSignals[1],
        oldIdentityTreeRoot: publicSignals[2],
        newIdentityTreeRoot: publicSignals[3],
        gradeCommitmentIndex: publicSignals[4],
        gradeCommitment: publicSignals[5],
        oldGradeTreeRoot: publicSignals[6],
        newGradeTreeRoot: publicSignals[7],
        testRoot: publicSignals[8],
        testParameters: publicSignals[9],
        publicSignals,
        proof: packProof(proof)
    }
}
