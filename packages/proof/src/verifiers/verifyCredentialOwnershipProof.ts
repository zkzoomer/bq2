import { verifyProof, FullProof } from "@semaphore-protocol/proof"
import { N_LEVELS } from "../constants"

/**
 * Verifies a Semaphore proof of credential or credentials ownership.
 * @param fullProof The SnarkJS Semaphore proof of credential(s) ownership.
 * @returns True if the proof is valid, false otherwise, or an array of these.
 */
export default async function verifyCredentialOwnershipProof(
    fullProof: FullProof | FullProof[]
): Promise<boolean | boolean[]> {
    if (Array.isArray(fullProof)) {
        let validProofs: boolean[] = [];

        var i = 0, len = fullProof.length
        while (i < len) {
            const validProof = await verifyProof(fullProof[i], N_LEVELS)

            validProofs.push(validProof)

            ++i;
        }

        return validProofs;
    } else {
        return verifyProof(fullProof, N_LEVELS)
    }
}
