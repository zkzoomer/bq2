import { generateTestProof, CredentialRestrictedTestFullProof, SnarkArtifacts, TestAnswers, TestVariables } from "@bq2/lib"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { utils } from "ethers"

/**
 * Generates a proof of knowledge of a solution to a Block Qualified test, while also proving ownership of a different credential.
 * @param identity The Semaphore identity that will be associated with the solution.
 * @param testAnswers: The answers that the user provided for this test, comprised of the multiple choice and open answers.
 * @param testVariables: The variables that define the test and its grading.
 * @param requiredCredentialsGroup The Semaphore credentials group or its Merkle proof of the credential the user already owns.
 * @param testIdentityGroup The Semaphore group or its Merkle proof for the corresponding identity group. When providing a passing solution, this group is the credentials group. Otherwise, it is the no credentials group.
 * @param gradeGroup The Semaphore group or its Merkle proof for the grade group.
 * @param testSnarkArtifacts The SNARK artifacts for the Test proof.
 * @param semaphoreSnarkArtifacts The SNARK artifacts for the Semaphore proof.
 * @param testId The ID of the test being solved, used to compute the zero leaf of the Merkle trees.
 * @returns The test solution proof ready to be verified.
 */
export default async function generateCredentialRestrictedTestProof(
    identity: Identity,
    testAnswers: TestAnswers,
    testVariables: TestVariables,
    testIdentityGroup: Group | MerkleProof,
    gradeGroup: Group | MerkleProof,
    requiredCredentialsGroup: Group | MerkleProof,
    testSnarkArtifacts?: SnarkArtifacts,
    semaphoreSnarkArtifacts?: SnarkArtifacts,
    testId?: number
): Promise<CredentialRestrictedTestFullProof> {
    const testFullProof = await generateTestProof(identity, testAnswers, testVariables, testIdentityGroup, gradeGroup, testSnarkArtifacts, testId)

    const externalNullifier = utils.formatBytes32String("bq-credential-restricted-test")  // 0x62712d63726564656e7469616c2d726573747269637465642d74657374000000

    const encodedSignalPreimage = utils.defaultAbiCoder.encode(
        ["uint", "uint", "uint", "uint"], 
        [
            testFullProof.identityCommitment,
            testFullProof.newIdentityTreeRoot,
            testFullProof.gradeCommitment,
            testFullProof.newGradeTreeRoot
        ]
    )
    const signal = BigInt(utils.keccak256(encodedSignalPreimage))

    const semaphoreFullProof = await generateProof(identity, requiredCredentialsGroup, externalNullifier, signal, semaphoreSnarkArtifacts)

    return {
        testFullProof,
        semaphoreFullProof
    }
}
