import { BytesLike, Hexable } from "@ethersproject/bytes"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, FullProof } from "@semaphore-protocol/proof"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { SnarkArtifacts } from "../types"
import { N_LEVELS } from "../constants"

/**
 * Generates a Semaphore proof of credential ownership or ownerships.
 * @param identity The Semaphore identity.
 * @param groupOrMerkleProof The Semaphore group(s) or its Merkle proof(s).
 * @param externalNullifier The external nullifier.
 * @param signal The Semaphore signal.
 * @param snarkArtifacts The SNARK artifacts.
 * @returns The Semaphore proof(s) ready to be verified.
 */
export default async function generateCredentialOwnershipProof(
    identity: Identity,
    groupOrMerkleProof: Group | MerkleProof | (Group | MerkleProof)[],
    externalNullifier: BytesLike | Hexable | number | bigint,
    signal: BytesLike | Hexable | number | bigint,
    snarkArtifacts?: SnarkArtifacts
): Promise<FullProof | FullProof[]> {
    if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: `https://www.trusted-setup-pse.org/semaphore/${N_LEVELS}/semaphore.wasm`,
            zkeyFilePath: `https://www.trusted-setup-pse.org/semaphore/${N_LEVELS}/semaphore.zkey`
        }
    }

    if (Array.isArray(groupOrMerkleProof)) {
        let ownershipProofs: FullProof[] = [];

        var i = 0, len = groupOrMerkleProof.length

        while (i < len) {
            const ownershipProof = await generateProof(identity, groupOrMerkleProof[i], externalNullifier, signal, snarkArtifacts)

            ownershipProofs.push(ownershipProof)

            i++
        }

        return ownershipProofs
    } else {
        return generateProof(identity, groupOrMerkleProof, externalNullifier, signal, snarkArtifacts)
    }
}
