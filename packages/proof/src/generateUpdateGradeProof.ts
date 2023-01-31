import { Group } from "@semaphore-protocol/group"
import type { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { poseidon } from "circomlibjs"
import { groth16 } from "snarkjs"
import { UpdateGradeFullProof, SnarkArtifacts, TestAnswers, TestParameters } from "./types"
import { packProof } from "./helpers/packProof"
import { ZERO_LEAF } from "./constants"
import { Poseidon, buildPoseidon } from "./helpers/buildPoseidon"

export default async function generateUpdateGradeProof(
    { trapdoor, nullifier }: Identity,
    { multipleChoiceAnswers, openAnswers }: TestAnswers,
    { minimumGrade, multipleChoiceWeight, nQuestions, solutionHash, openAnswersHashes, openAnswersHashesRoot }: TestParameters,
    gradeGroupOrMerkleProof: Group | MerkleProof,
    currentGrade: number, // TODO: wont't have to be provided in the future and simply brute forced - would take a max of 130 tries
    gradeIndex: number, // TODO: wont't have to be provided in the future and simply brute forced - would take a max of 130 tries
    snarkArtifacts: SnarkArtifacts
    /* snarkArtifacts?: SnarkArtifacts */
): Promise<UpdateGradeFullProof> {
    let gradeMerkleProof: MerkleProof
    let poseidon: Poseidon

    poseidon = await buildPoseidon();

    if ("depth" in gradeGroupOrMerkleProof) {
        const index = gradeGroupOrMerkleProof.indexOf(gradeIndex)

        gradeMerkleProof = gradeGroupOrMerkleProof.generateMerkleProof(index)
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
            currentGrade,
            gradeTreePathIndices: gradeMerkleProof.pathIndices,
            gradeTreeSiblings: gradeMerkleProof.siblings
        },
        snarkArtifacts.wasmFilePath,
        snarkArtifacts.zkeyFilePath
    )

    return {
        gradeCommitmentIndex: publicSignals[0],
        oldGradeCommitment: publicSignals[1],
        newGradeCommitment: publicSignals[2],
        oldGradeTreeRoot: publicSignals[3],
        newGradeTreeRoot: publicSignals[4],
        testRoot: publicSignals[5],
        testParameters: publicSignals[6],
        publicSignals,
        proof: packProof(proof)
    }
}
