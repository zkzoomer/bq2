// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @title Credentials interface.
/// @dev Interface of a Credentials contract.
interface ICredentials {
    error CallerIsNotTheTestAdmin();

    error TimeLimitIsInThePast();
    error InvalidNumberOfQuestions();
    error InvalidMinimumGrade();
    error InvalidMultipleChoiceWeight();
    error InvalidCredentialLimit();

    error TestAnswersAlreadyVerified();
    error InvalidTestAnswersLength(uint256 expectedLength, uint256 providedLength);

    error TestAlreadyInvalid();
    
    error InvalidTestRoot(uint256 expectedTestRoot, uint256 providedTestRoot);
    error InvalidTestParameters(uint256 expectedTestParameters, uint256 providedTestParameters);
    error InvalidTreeIndex(uint256 expectedIndex, uint256 providedIndex);
    error InvalidTreeRoot(uint256 expectedRoot, uint256 providedRoot);
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
        uint16 credentialLimit;
        /// Unix time limit after which it is not possible to obtain this credential -- set 0 for unlimited
        uint32 timeLimit;
        /// Address that controls this credential
        address admin;
        /// Root of the multiple choice Merkle tree, where each leaf is the correct choice out of the given ones
        uint256 multipleChoiceRoot;
        /// Root of the open answers Merkle tree, where each leaf is the hash of the corresponding correct answer
        uint256 openAnswersRoot;
        /// The test root is the result of hashing together the multiple choice root and the open answers root
        uint256 testRoot;
        /// The test parameters are the result of hashing together the minimum grade, multiple choice weight and number of questions
        uint256 testParameters;
    }

    /// It defines all the test group parameters
    struct TestGroup {
        /// Leaf index of the next empty credentials tree leaf
        uint128 credentialsTreeIndex;
        /// Leaf index of the next empty no-credentials tree leaf
        uint128 noCredentialsTreeIndex;
        /// Root hash of the credentials tree
        uint256 credentialsTreeRoot;
        /// Root hash of the grade tree
        uint256 gradeTreeRoot;
        /// Root hash of the no credentials tree root
        uint256 noCredentialsTreeRoot;
    }

    /// @dev Emitted when a test is created
    /// @param testId: id of the test
    event TestCreated(uint256 indexed testId);

    /// @dev Emitted when an admin is assigned to a group.
    /// @param testId: id of the test.
    /// @param oldAdmin: old admin of the group
    /// @param newAdmin: new admin of the group
    event TestAdminUpdated(uint256 indexed testId, address indexed oldAdmin, address indexed newAdmin);

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
    /// @param admin: see the `Test` struct
    /// @param multipleChoiceRoot: see the `Test` struct
    /// @param openAnswersRoot: see the `Test` struct
    /// @param testURI: see the `Test` struct
    function createTest(
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint8 minimumGrade,
        uint16 credentialLimit,
        uint32 timeLimit,
        address admin,
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
    ) external;

    /// @dev Changes the test admin to the one provided
    /// @param newAdmin: address of the new admin to manage the test
    function updateTestAdmin(uint256 testId, address newAdmin) external;

    /// @dev Invalidates the test so that it is no longer solvable by anyone by setting its minimum grade to 255
    /// @param testId: id of the test
    function invalidateTest(uint256 testId) external;

    /// @dev If the given proof of knowledge of the solution is valid, adds the gradeCommitment to the gradeTree
    /// and the identityCommitment to the credentialsTree; otherwise, it adds the identityCommitment to the 
    /// no-credentials tree
    /// @param testId: id of the test
    /// @param input: the public inputs of the proof, these being:
    ///     - identityCommitmentIndex: the index within the identity tree of the new identity commitment
    ///     - identityCommitment: new identity commitment
    ///     - oldIdentityTreeRoot: old root of the identity tree
    ///     - newIdentityTreeRoot: new root of the identity tree result of adding the identity commitment
    ///     - gradeCommitmentIndex: the index within the grade tree of the new grade commitment
    ///     - gradeCommitment: new grade commitment
    ///     - oldGradeTreeRoot: old root of the grade tree
    ///     - newGradeTreeRoot: new root of the grade tree result of adding the grade commitment
    ///     - testRoot: root of the test that is being solved
    ///     - testParameters: test parameters used for grading, Poseidon(minimumGrade, multipleChoiceWeight, nQuestions)
    /// @param proofA: SNARK proof
    /// @param proofB: SNARK proof
    /// @param proofC: SNARK proof
    function solveTest(
        uint256 testId,
        uint256[10] calldata input,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external;

    /// @dev If the given proof of knowledge of the solution is valid, adds the gradeCommitment to the gradeTree
    /// and the identityCommitment to the credentialsTree; otherwise, it adds the identityCommitment to the 
    /// no-credentials tree
    /// @param testId: Id of the test
    /// @param input: the public inputs of the proof, these being:
    ///     - gradeCommitmentIndex: the index within the grade tree of the grade commitments
    ///     - oldGradeCommitment: existing grade commitment that is being replaced
    ///     - newGradeCommitment: new grade commitment replacing the old one
    ///     - oldGradeTreeRoot: old root of the grade tree
    ///     - newGradeTreeRoot: new root of the grade tree result of updating the grade commitment
    ///     - testRoot: root of the test that is being solved
    ///     - testParameters: test parameters used for grading, Poseidon(multipleChoiceWeight, nQuestions)
    /// @param proofA: SNARK proof
    /// @param proofB: SNARK proof
    /// @param proofC: SNARK proof
    function updateGrade(
        uint256 testId,
        uint256[7] calldata input,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external;

    /// @dev Returns the parameters of a given test in the form of the `Test` struct
    /// @param testId: id of the test
    /// @return Test parameters
    function getTest(uint256 testId) external view returns (Test memory);

    /// @dev Returns the external resource of the test
    /// @param testId: id of the test
    /// @return Test URI
    function getTestURI(uint256 testId) external view returns (string memory);

    /// @dev Returns the root of the multiple choice Merkle tree of the test
    /// @param testId: id of the test
    /// @return Root hash of the multiple choice answers tree
    function getMultipleChoiceRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the root of the open answers Merkle tree of the test
    /// @param testId: id of the test
    /// @return Root hash of the open answer hashes tree
    function getOpenAnswersRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the open answer hashes of the test
    /// @param testId: id of the test
    /// @return Open answer hashes
    function getOpenAnswersHashes(uint256 testId) external view returns (uint256[] memory);

    /// @dev Returns the test root, testRoot = Poseidon(multipleChoiceRoot, openAnswersRoot)
    /// @param testId: id of the test
    /// @return Hash of the multiple choice root and the open answers root
    function getTestRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the test parameters, testParameters = Poseidon(minimumGrade, multipleChoiceWeight, nQuestions)
    /// @param testId: id of the test
    /// @return Hash of the minimum grade, multiple choice weight and the number of questions
    function getTestParameters(uint256 testId) external view returns (uint256);

    /// @dev Returns whether the test exists
    /// @param testId: id of the test
    /// @return Test existence
    function testExists(uint256 testId) external view returns (bool);

    /// @dev Returns whether the test is valid, that is, if it can be solved 
    /// @param testId: id of the test
    /// @return Test validity
    function testIsValid(uint256 testId) external view returns (bool);

    /// @dev Returns the last root hash of the grade tree group
    /// @param testId: id of the test
    /// @return Root hash of the grade tree
    function getGradeTreeRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the last root hash of the no credentials tree group
    /// @param testId: id of the test
    /// @return Root hash of the no credentials tree
    function getNoCredentialsTreeRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the number of tree leaves of the no credentials tree group
    /// @param testId: id of the test
    /// @return Number of no credentials tree leaves
    function getNumberOfNoCredentialsTreeLeaves(uint256 testId) external view returns (uint256);
}
