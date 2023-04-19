import { RateFullProof, SnarkArtifacts, MAX_COMMENT_LENGTH, MAX_TREE_DEPTH } from "@bq-core/lib"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof } from "@semaphore-protocol/proof"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { AbiCoder, keccak256 } from "ethers"
import { formatBytes32String } from "@ethersproject/strings"

/**
 * Rates a credential issuer by generating a Semaphore proof of credential ownership.
 * @param identity The Semaphore identity.
 * @param groupOrMerkleProof The Semaphore group or its Merkle proof.
 * @param rate The rating given to the credential issuer, from 0 to 100.
 * @param snarkArtifacts The SNARK artifacts.
 * @returns The Semaphore proof ready to be verified.
 */
export default async function generateRateCredentialIssuerProof(
    identity: Identity,
    groupOrMerkleProof: Group | MerkleProof,
    rating: number,
    comment: string,
    snarkArtifacts?: SnarkArtifacts
): Promise<RateFullProof> {
    const externalNullifier = formatBytes32String("bq-rate")  // 0x62712d7261746500000000000000000000000000000000000000000000000000

    const abi = new AbiCoder()

    const encodedRating = abi.encode(["uint", "string"], [rating, comment])
    const signal = BigInt(keccak256(encodedRating))
    
    if (rating > 100 || rating < 0) {
        throw new Error("Rating value is not supported")
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
        throw new Error("Comment length is too long")
    }

    if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: `https://www.trusted-setup-pse.org/semaphore/${MAX_TREE_DEPTH}/semaphore.wasm`,
            zkeyFilePath: `https://www.trusted-setup-pse.org/semaphore/${MAX_TREE_DEPTH}/semaphore.zkey`
        }
    }

    const semaphoreFullProof = await generateProof(identity, groupOrMerkleProof, externalNullifier, signal, snarkArtifacts)

    return {
        rating,
        comment,
        semaphoreFullProof
    }
}
