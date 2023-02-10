import { BigNumber } from "@ethersproject/bignumber"
import { BytesLike, Hexable } from "@ethersproject/bytes"
import { Group } from "@semaphore-protocol/group"
import type { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { groth16 } from "snarkjs"
import { GradeClaimFullProof, SnarkArtifacts, TestGradingVariables, FullGradeCommitment } from "../types"
import packProof from "../helpers/packProof"
import getGradeCommitment from "../helpers/getGradeCommitment"
import hash from "../helpers/hash"

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
    gradeThreshold: number | number,
    externalNullifier: BytesLike | Hexable | number | bigint | string,
    signal: BytesLike | Hexable | number | bigint | string,
    gradeCommitmentOrTestGradingVariables: TestGradingVariables | FullGradeCommitment,
    snarkArtifacts?: SnarkArtifacts
): Promise<GradeClaimFullProof> {
    let gradeMerkleProof: MerkleProof
    let gradeCommitment: FullGradeCommitment

    if (!snarkArtifacts) {
        throw new Error("SNARK artifacts need to be provided")
        /* snarkArtifacts = {
            wasmFilePath: ``,
            zkeyFilePath: ``
        } */
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
        if (!("weightedGrade" in gradeCommitmentOrTestGradingVariables)) {
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
            grade: gradeCommitment.weightedGrade,
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
        gradeThreshold: publicSignals[2],
        signal: signal,
        externalNullifier: externalNullifier,
        proof: packProof(proof)
    }
}
