import { 
    generateGradeClaimProof, 
    generateTestProof, 
    FullGradeCommitment, 
    GradeRestrictedTestFullProof, 
    TestAnswers, 
    TestGradingVariables,
    TestVariables,
    SnarkArtifacts, 
} from "@bq2/lib"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { MerkleProof } from "@zk-kit/incremental-merkle-tree"
import { utils } from "ethers"

/**
 * Generates a proof of knowledge of a solution to a Block Qualified test, while also proving a grade over a certain threshold for a given credential
 * @param identity The Semaphore identity that will be associated with the solution.
 * @param testAnswers: The answers that the user provided for this test, comprised of the multiple choice and open answers
 * @param testIdentityGroup The Semaphore group or its Merkle proof for the corresponding identity group. When providing a passing solution, this group is the credentials group. Otherwise, it is the no credentials group.
 * @param testGradeGroup The Semaphore group or its Merkle proof for the grade group.
 * @param gradeClaimGroupOrMerkleProof The Semaphore group or its Merkle proof for the grade commitment of the user within the grade group for the credential they already own.
 * @param gradeClaimThreshold The grade the user claims to have obtained or surpassed for the credential they already own.
 * @param gradeClaimCommitmentOrTestGradingVariables The user's grade commitment within the tree or the test variables defining the test for the credential they already own.
 * @param testSnarkArtifacts The SNARK artifacts for the Test proof.
 * @param gradeClaimSnarkArtifacts The SNARK artifacts for the grade claim proof.
 * @param testId The ID of the test being solved, used to compute the zero leaf of the Merkle trees
 * @returns The test solution proof ready to be verified.
 */
export default async function generateGradeRestrictedTestProof(
    identity: Identity,
    testAnswers: TestAnswers,
    testVariables: TestVariables,
    testIdentityGroup: Group | MerkleProof,
    testGradeGroup: Group | MerkleProof,
    gradeClaimGroupOrMerkleProof: Group | MerkleProof,
    gradeClaimThreshold: number,
    gradeClaimCommitmentOrTestGradingVariables: TestGradingVariables | FullGradeCommitment,
    testSnarkArtifacts?: SnarkArtifacts,
    gradeClaimSnarkArtifacts?: SnarkArtifacts,
    testId?: number
): Promise<GradeRestrictedTestFullProof> {
    const testFullProof = await generateTestProof(identity, testAnswers, testVariables, testIdentityGroup, testGradeGroup, testSnarkArtifacts, testId)

    const externalNullifier = utils.formatBytes32String("bq-grade-restricted-test")  // 0x62712d67726164652d726573747269637465642d746573740000000000000000

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

    const gradeClaimFullProof = await generateGradeClaimProof(identity, gradeClaimGroupOrMerkleProof, gradeClaimThreshold, externalNullifier, signal, gradeClaimCommitmentOrTestGradingVariables, gradeClaimSnarkArtifacts)
    
    return {
        testFullProof,
        gradeClaimFullProof
    }
}
