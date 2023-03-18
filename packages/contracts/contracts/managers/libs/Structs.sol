// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// It defines all the test parameters.
struct CredentialTest {
    /// Out of 100, minimum total grade the user must get to obtain the credential.
    uint8 minimumGrade;  
    /// Out of 100, contribution of the multiple choice component towards the total grade:
    /// pure multiple choice tests will have 100, pure open answer tests will have 0.
    uint8 multipleChoiceWeight;
    /// Number of open answer questions the test has -- must be set to 1 for pure multiple choice tests.
    uint8 nQuestions;
    /// Unix time limit after which it is not possible to obtain this credential -- set 0 for unlimited
    uint32 timeLimit;
    /// Address that controls this credential.
    address admin;
    /// The testId of the credential that needs to be obtained before this one -- set 0 for unrestricted.
    uint256 requiredCredential;
    /// Minimum grade that must be obtained for the required credential -- set 0 for unrestricted.
    uint256 requiredCredentialGradeThreshold;
    /// Root of the multiple choice Merkle tree, where each leaf is the correct choice out of the given ones.
    uint256 multipleChoiceRoot;
    /// Root of the open answers Merkle tree, where each leaf is the hash of the corresponding correct answer.
    uint256 openAnswersHashesRoot;
    /// The test root is the result of hashing together the multiple choice root and the open answers root.
    uint256 testRoot;
    /// The test parameters are the result of hashing together the minimum grade, multiple choice weight and number of questions.
    uint256 testParameters;
    /// The non passing test parameters are the result of hashing together a minimum grade set to zero, multiple choice weight and number of questions.
    uint256 nonPassingTestParameters;
}

/// Defines the test parameters that are necessary to initialize a new credential test.
struct TestInitializingParameters {
    /// Out of 100, minimum total grade the user must get to obtain the credential.
    uint8 minimumGrade;
    /// Out of 100, contribution of the multiple choice component towards the total grade:
    /// pure multiple choice tests will have 100, pure open answer tests will have 0.
    uint8 multipleChoiceWeight;
    /// Number of open answer questions the test has -- must be set to 1 for pure multiple choice tests.
    uint8 nQuestions;
    /// Unix time limit after which it is not possible to obtain this credential -- set 0 for unlimited.
    uint32 timeLimit;
    /// Address that controls this credential.
    address admin;
    /// The testId of the credential that needs to be obtained before this one -- set 0 for unrestricted.
    uint256 requiredCredential;
    /// Minimum grade that must be obtained for the required credential -- set 0 for unrestricted.
    uint256 requiredCredentialGradeThreshold;
    /// Root of the multiple choice Merkle tree, where each leaf is the correct choice out of the given ones.
    uint256 multipleChoiceRoot;
    /// Root of the open answers Merkle tree, where each leaf is the hash of the corresponding correct answer.
    uint256 openAnswersHashesRoot;
}

/// Defines the parameters that make up a solution proof to a credential test.
struct TestFullProof {
    /// New identity commitment to add to the identity tree (credentials or no credentials tree).
    uint256 identityCommitment;
    /// New root of the identity tree result of adding the identity commitment (credentials or no credentials tree)
    uint256 newIdentityTreeRoot;
    /// New grade commitment to add to the grade tree.
    uint256 gradeCommitment;
    /// New root of the grade tree result of adding the grade commitment.
    uint256 newGradeTreeRoot;
    /// Zero-knowledge proof to the Test circuit.
    uint256[8] testProof;
    /// Whether the test was passed or not
    bool testPassed;
}

/// Defines the parameters that make up a Semaphore proof of inclusion.
struct CredentialClaimFullProof {
    /// Merkle root of the required credential Merkle tree.
    uint256 requiredCredentialMerkleTreeRoot;
    /// Semaphore proof nullifier hash.
    uint256 nullifierHash;
    /// Semaphore zero-knowledge proof.
    uint256[8] semaphoreProof;
}

/// Defines the parameters that make up a grade claim proof.
struct GradeClaimFullProof {
    /// Merkle root of the grade commitment Merkle tree.
    uint256 gradeClaimMerkleTreeRoot;
    /// Grade claim proof nullifier hash.
    uint256 nullifierHash;
    /// Grade claim zero-knowledge proof.
    uint256[8] gradeClaimProof;
}

/// Defines the parameters that make up a solution proof to a credential test, plus an inclusion proof
/// inside the required credential group.
struct CredentialRestrictedTestFullProof {
    /// The corresponding Semaphore full proof
    CredentialClaimFullProof credentialClaimFullProof;
    /// The corresponding test full proof
    TestFullProof testFullProof;
}

/// Defines the parameters that make up a solution proof to a credential test, plus a grade claim proof
/// inside the corresponding grade group
struct GradeRestrictedTestFullProof {
    /// The corresponding grade claim proof
    GradeClaimFullProof gradeClaimFullProof;
    /// The corresponding test full proof
    TestFullProof testFullProof;
}
