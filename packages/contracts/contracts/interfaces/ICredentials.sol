// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @title Credentials interface.
/// @dev Interface of a Credentials contract.
interface ICredentials {
    error CallerIsNotTheTestAdmin();
    error InvalidMultipleChoiceWeight();
    error InvalidNumberOfQuestions();
    error InvalidMinimumGrade();
    error InvalidCredentialLimit();
    error TimeLimitIsInThePast();
    error SolutionIsNotValid();

    /// It defines all the test parameters
    struct Test {
        /// Out of 100, contribution of the multiple choice component towards the total grade:
        /// pure multiple choice tests will have 100, pure open answer tests will have 0
        uint8 multipleChoiceWeight;
        /// Number of open answer questions the test has -- must be set to 1 for pure multiple choice tests
        uint8 nQuestions;
        /// Out of 100, minimum total grade the user must get to obtain the credential
        uint8 minimumGrade;  
        /// Maximum number of users that can obtain this credential -- set to 0 for unlimited
        uint24 credentialLimit;
        /// Unix time limit after which it is not possible to obtain this credential -- set 0 for unlimited
        uint32 timeLimit;
        /// Address that controls this credential
        address admin;
        /// Root of the multiple choice Merkle tree, where each leaf is the correct choice out of the given ones
        uint256 multipleChoiceRoot;
        /// Root of the open answers Merkle tree, where each leaf is the hash of the corresponding correct answer
        uint256 openAnswersRoot;
        /// External resource containing the actual test and more information about the credential
        string testURI;
    }

    /// @dev Emitted when a test is invalidated by its admin
    /// @param testId: id of the test
    event TestInvalidated(uint256 indexed testId);

    /// @dev Emitted when a test is solved and the credentials are gained
    /// @param testId: id of the test
    /// @param identityCommitment: new identity commitment added to the credentials tree
    /// @param gradeCommitment: new grade commitment added to the grade tree
    event CredentialsGained(uint256 indexed testId, uint256 indexed identityCommitment, uint256 gradeCommitment);

    /// @dev Emitted when a test is not solved and thus the credentials are not gained
    /// @param testId: id of the test
    /// @param identityCommitment: new identity commitment added to the no-credentials tree
    event CredentialsNotGained(uint256 indexed testId, uint256 indexed identityCommitment);

    /// @dev Creates a new test with the test parameters as specified in the `Test` struct
    /// @param multipleChoiceWeight: see the `Test` struct
    /// @param nQuestions: see the `Test` struct
    /// @param minimumGrade: see the `Test` struct
    /// @param credentialLimit: see the `Test` struct
    /// @param timeLimit: see the `Test` struct
    /// @param multipleChoiceRoot: see the `Test` struct
    /// @param openAnswersRoot: see the `Test` struct
    /// @param testURI: see the `Test` struct
    function createTest(
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint8 minimumGrade,
        uint24 credentialLimit,
        uint32 timeLimit,
        uint256 multipleChoiceRoot,
        uint256 openAnswersRoot,
        string memory testURI
    ) external;

    /// @dev Stores the open answer hashes on-chain, "verifying" the corresponding test
    /// No actual check is made to see if these correspond to the openAnswerHashesRoot, we assume it's in
    /// the credential issuer's best interest to provide the valid open answer hashes
    /// @param testId: id of the test
    /// @param answerHashes: array containing the hashes of each of the answers of the test
    function verifyTestAnswers(
        uint256 testId,
        uint256[] memory answerHashes
    ) external ;

    /// @dev Invalidates the test so that it is no longer solvable by anyone
    /// @param testId: id of the test
    function invalidateTest(uint256 testId) external;

    /// @dev If the given proof of knowledge of the solution is valid, adds the gradeCommitment to the gradeTree
    /// and the identityCommitment to the credentialsTree; otherwise, it adds the identityCommitment to the 
    /// no-credentials tree
    /// @param testId: id of the test
    /// @param identityCommitmentIndex: the index within the identity tree of the new identity commitment
    /// @param identityCommitment: new identity commitment
    /// @param oldIdentityTreeRoot: old root of the identity tree
    /// @param newIdentityTreeRoot: new root of the identity tree result of adding the identity commitment
    /// @param gradeCommitmentIndex: the index within the grade tree of the new grade commitment
    /// @param gradeCommitment: new grade commitment
    /// @param oldGradeTreeRoot: old root of the grade tree
    /// @param newGradeTreeRoot: new root of the grade tree result of adding the grade commitment
    /// @param testRoot: root of the test that is being solved
    /// @param testParameters: test parameters used for grading, Poseidon(minimumGrade, multipleChoiceWeight, nQuestions)
    /// @param proofA: SNARK proof
    /// @param proofB: SNARK proof
    /// @param proofC: SNARK proof
    function solveTest(
        uint256 testId,
        uint256 identityCommitmentIndex,
        uint256 identityCommitment,
        uint256 oldIdentityTreeRoot,
        uint256 newIdentityTreeRoot,
        uint256 gradeCommitmentIndex,
        uint256 gradeCommitment,
        uint256 oldGradeTreeRoot,
        uint256 newGradeTreeRoot,
        uint256 testRoot,
        uint256 testParameters,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external;

    /// @dev If the given proof of knowledge of the solution is valid, adds the gradeCommitment to the gradeTree
    /// and the identityCommitment to the credentialsTree; otherwise, it adds the identityCommitment to the 
    /// no-credentials tree
    /// @param testId: Id of the test
    /// @param gradeCommitmentIndex: the index within the grade tree of the grade commitments
    /// @param oldGradeCommitment: existing grade commitment that is being replaced
    /// @param newGradeCommitment: new grade commitment replacing the old one
    /// @param oldGradeTreeRoot: old root of the grade tree
    /// @param newGradeTreeRoot: new root of the grade tree result of updating the grade commitment
    /// @param testRoot: root of the test that is being solved
    /// @param testParameters: test parameters used for grading, Poseidon(multipleChoiceWeight, nQuestions)
    /// @param proofA: SNARK proof
    /// @param proofB: SNARK proof
    /// @param proofC: SNARK proof
    function improveSolution(
        uint256 testId,
        uint256 gradeCommitmentIndex,
        uint256 oldGradeCommitment,
        uint256 newGradeCommitment,
        uint256 oldGradeTreeRoot,
        uint256 newGradeTreeRoot,
        uint256 testRoot,
        uint256 testParameters,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external;

    /// @dev Returns the parameters of a given test in the form of the `Test` struct
    /// @param testId: id of the test
    function getTest(uint256 testId) external view returns (Test memory);

    /// @dev Returns the external resource of the test
    /// @param testId: id of the test
    function getTestURI(uint256 testId) external view returns (string memory);

    /// @dev Returns the root of the multiple choice Merkle tree of the test
    /// @param testId: id of the test
    function getMultipleChoiceRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the root of the open answers Merkle tree of the test
    /// @param testId: id of the test
    function getOpenAnswersRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the open answer hashes of the test
    /// @param testId: id of the test
    function getOpenAnswersHashes(uint256 testId) external view returns (uint256[] memory);

    /// @dev Returns the test root, testRoot = Poseidon(multipleChoiceRoot, openAnswersRoot)
    /// @param testId: id of the test
    function getTestRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns whether the test exists
    /// @param testId: id of the test
    function testExists(uint256 testId) external view returns (bool);

    /// @dev Returns whether the test is valid, that is, if it can be solved 
    /// @param testId: id of the test
    function testIsValid(uint256 testId) external view returns (bool);
}
