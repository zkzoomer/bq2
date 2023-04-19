import { MAX_TREE_DEPTH } from "@bq-core/lib"
import { verifyProof, FullProof } from "@semaphore-protocol/proof"

/**
 * Verifies a Semaphore proof of credential ownership.
 * @param fullProof The SnarkJS Semaphore proof of credential ownership.
 * @returns True if the proof is valid, false otherwise.
 */
export default async function verifyCredentialOwnershipProof(
    fullProof: FullProof
): Promise<boolean> {
    return verifyProof(fullProof, MAX_TREE_DEPTH)
}
