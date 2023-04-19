import { SnarkArtifacts, MAX_TREE_DEPTH } from "@bq-core/lib"
import { BytesLike, Hexable } from "@ethersproject/bytes"
import { formatBytes32String } from "@ethersproject/strings"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, FullProof } from "@semaphore-protocol/proof"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"

/**
 * Generates a Semaphore proof of credential ownership.
 * @param identity The Semaphore identity.
 * @param groupOrMerkleProof The Semaphore group or its Merkle proof.
 * @param externalNullifier The external nullifier.
 * @param signal The Semaphore signal.
 * @param snarkArtifacts The SNARK artifacts.
 * @returns The Semaphore proof ready to be verified.
 */
export default async function generateCredentialOwnershipProof(
    identity: Identity,
    groupOrMerkleProof: Group | MerkleProof,
    externalNullifier: BytesLike | Hexable | number | bigint | string,
    signal: BytesLike | Hexable | number | bigint | string,
    snarkArtifacts?: SnarkArtifacts
): Promise<FullProof> {
    if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: `https://www.trusted-setup-pse.org/semaphore/${MAX_TREE_DEPTH}/semaphore.wasm`,
            zkeyFilePath: `https://www.trusted-setup-pse.org/semaphore/${MAX_TREE_DEPTH}/semaphore.zkey`
        }
    }

    if (typeof externalNullifier === 'string') {
        externalNullifier = formatBytes32String(externalNullifier)
    }
    
    if(typeof signal === 'string') {
        signal = formatBytes32String(signal)
    }
     
    return generateProof(identity, groupOrMerkleProof, externalNullifier, signal, snarkArtifacts)
}
