import { verifyProof, FullProof } from "@semaphore-protocol/proof"
import { N_LEVELS } from "../constants"

/**
 * Verifies a Semaphore proof of credential ownership.
 * @param fullProof The SnarkJS Semaphore proof of credential ownership.
 * @returns True if the proof is valid, false otherwise.
 */
export default async function verifyCredentialOwnershipProof(
    fullProof: FullProof
): Promise<boolean> {
    return verifyProof(fullProof, N_LEVELS)
}
