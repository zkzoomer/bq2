import { formatBytes32String } from "@ethersproject/strings"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof } from "@semaphore-protocol/proof"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { utils } from "ethers"
import { RateFullProof, SnarkArtifacts } from "../types"
import { MAX_COMMENT_LENGTH, N_LEVELS } from "../constants"

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
    rate: number,
    comment: string,
    snarkArtifacts?: SnarkArtifacts
): Promise<RateFullProof> {
    const externalNullifier = formatBytes32String("bq-rate")

    const encodedRating = utils.defaultAbiCoder.encode(["uint", "string"], [rate, comment])
    const signal = BigInt(utils.keccak256(encodedRating)) >> BigInt(8)
    
    if (rate > 100 || rate < 0) {
        throw new Error("Rating value is not supported")
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
        throw new Error("Comment length is too long")
    }

    if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: `https://www.trusted-setup-pse.org/semaphore/${N_LEVELS}/semaphore.wasm`,
            zkeyFilePath: `https://www.trusted-setup-pse.org/semaphore/${N_LEVELS}/semaphore.zkey`
        }
    }

    const fullProof = await generateProof(identity, groupOrMerkleProof, externalNullifier, signal, snarkArtifacts)

    return {
        rate,
        comment,
        fullProof
    }
}
