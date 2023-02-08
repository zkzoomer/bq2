import { groth16 } from "snarkjs"
import hash from "../helpers/hash"
import { GradeClaimFullProof } from "../types"
import unpackProof from "../helpers/unpackProof"
import verificationKey from "../../snark-artifacts/gradeClaimKey.json"

/**
 * Verifies a proof where a user claims to have obtained a grade above a certain threshold,
 * @param gradeClaimFullProof The SnarkJS proof of grade claim.
 * @returns True if the proof is valid, false otherwise.
 */
export default async function verifyGradeClaimProof(
    { gradeTreeRoot, nullifierHash, gradeThreshold, signal, externalNullifier, proof }: GradeClaimFullProof,
): Promise<boolean> {
    return groth16.verify(
        verificationKey,
        [gradeTreeRoot, nullifierHash, gradeThreshold, hash(signal), hash(externalNullifier)],
        unpackProof(proof)
    )
}
