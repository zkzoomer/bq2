import { GradeClaimFullProof } from "@bq-core/lib"
import { groth16 } from "snarkjs"
import { hash, unpackProof } from "../helpers"
import verificationKey from "../../verification-keys/gradeClaimKey.json"

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
