import { FullGradeCommitment, GradeClaimFullProof, SnarkArtifacts, TestGradingVariables } from "@bq-core/lib"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { groth16 } from "snarkjs"
import { packProof, getGradeCommitment, hash } from "../helpers"

/**
 * Generates a proof claiming to have obtained a grade above a certain threshold.
 * @param identity The Semaphore identity that is associated with this grade obtained.
 * @param gradeGroupOrMerkleProof The Semaphore group or its Merkle proof for the grade commitment of the user within the grade group.
 * @param gradeThreshold The grade the user claims to have obtained or surpassed.
 * @param signal The Semaphore signal.
 * @param externalNullifier The external nullifier.
 * @param gradeCommitmentOrTestGradingVariables The user's grade commitment within the tree or the test variables defining the test.
 * @param snarkArtifacts The SNARK artifacts.
 * @returns The grade claim proof ready to be verified.
 */
export default async function generateGradeClaimProof(
    identity: Identity,
    gradeGroupOrMerkleProof: Group | MerkleProof,
    gradeThreshold: number,
    externalNullifier: number | bigint | string,
    signal: number | bigint | string,
    gradeCommitmentOrTestGradingVariables: TestGradingVariables | FullGradeCommitment,
    snarkArtifacts?: SnarkArtifacts
): Promise<GradeClaimFullProof> {
    let gradeMerkleProof: MerkleProof
    let gradeCommitment: FullGradeCommitment

    if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: `https://blockqualified.s3.us-east-2.amazonaws.com/gradeClaim.wasm`,
            zkeyFilePath: `https://blockqualified.s3.us-east-2.amazonaws.com/gradeClaim.zkey`
        }
    }

    if ("depth" in gradeGroupOrMerkleProof) {
        
        if ("nQuestions" in gradeCommitmentOrTestGradingVariables) {
            gradeCommitment = await getGradeCommitment(
                identity,
                gradeGroupOrMerkleProof,
                gradeCommitmentOrTestGradingVariables.multipleChoiceWeight,
                gradeCommitmentOrTestGradingVariables.nQuestions
            )
        } else {
            gradeCommitment = gradeCommitmentOrTestGradingVariables
        }

        gradeMerkleProof = gradeGroupOrMerkleProof.generateMerkleProof(gradeCommitment.gradeCommitmentIndex)
    } else {
        if (!("grade" in gradeCommitmentOrTestGradingVariables)) {
            throw new Error("Need to provide the FullGradeCommitment when providing a Merkle proof")
        }

        gradeCommitment = gradeCommitmentOrTestGradingVariables
        gradeMerkleProof = gradeGroupOrMerkleProof
    }

    const { proof, publicSignals } = await groth16.fullProve(
        {
            identityNullifier: identity.nullifier,
            identityTrapdoor: identity.trapdoor,
            gradeTreePathIndices: gradeMerkleProof.pathIndices,
            gradeTreeSiblings: gradeMerkleProof.siblings,
            grade: gradeCommitment.grade,
            gradeThreshold,
            signalHash: hash(signal),
            externalNullifier: hash(externalNullifier)
        },
        snarkArtifacts.wasmFilePath,
        snarkArtifacts.zkeyFilePath
    )

    return {
        gradeTreeRoot: publicSignals[0],
        nullifierHash: publicSignals[1],
        grade: gradeCommitment.grade,
        gradeThreshold,
        signal,
        externalNullifier,
        proof: packProof(proof)
    }
}
