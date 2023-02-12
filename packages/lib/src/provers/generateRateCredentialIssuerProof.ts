import { formatBytes32String } from "@ethersproject/strings"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, FullProof } from "@semaphore-protocol/proof"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { SnarkArtifacts } from "../types"
import { N_LEVELS } from "../constants"

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
    snarkArtifacts?: SnarkArtifacts
): Promise<FullProof> {
    const externalNullifier = formatBytes32String("bq-rate")

    if (rate > 100 || rate < 0) {
        throw new Error("Rating value is not supported")
    }

    if (!snarkArtifacts) {
        snarkArtifacts = {
            wasmFilePath: `https://www.trusted-setup-pse.org/semaphore/${N_LEVELS}/semaphore.wasm`,
            zkeyFilePath: `https://www.trusted-setup-pse.org/semaphore/${N_LEVELS}/semaphore.zkey`
        }
    }

    return generateProof(identity, groupOrMerkleProof, externalNullifier, Math.floor(rate), snarkArtifacts)
}
