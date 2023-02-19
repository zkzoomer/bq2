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

    error TestAnswersAlreadyVerified();
    error InvalidTestAnswersLength(uint256 expectedLength, uint256 providedLength);

    error TestWasInvalidated();
    error TimeLimitReached();
    
    error SolutionIsNotValid();

    error InvalidRating();

    error MerkleTreeRootIsNotPartOfTheGroup();
    error MerkleTreeRootIsExpired();
    error UsingSameNullifierTwice();

    error TestDoesNotExist();

    /// It defines all the test parameters
    struct Test {
        /// Out of 100, minimum total grade the user must get to obtain the credential
        uint8 minimumGrade;  
        /// Out of 100, contribution of the multiple choice component towards the total grade:
        /// pure multiple choice tests will have 100, pure open answer tests will have 0
        uint8 multipleChoiceWeight;
        /// Number of open answer questions the test has -- must be set to 1 for pure multiple choice tests
        uint8 nQuestions;
        /// Unix time limit after which it is not possible to obtain this credential -- set 0 for unlimited
        uint32 timeLimit;
        /// Address that controls this credential
        address admin;
        /// Root of the multiple choice Merkle tree, where each leaf is the correct choice out of the given ones
        uint256 multipleChoiceRoot;
        /// Root of the open answers Merkle tree, where each leaf is the hash of the corresponding correct answer
        uint256 openAnswersHashesRoot;
        /// The test root is the result of hashing together the multiple choice root and the open answers root
        uint256 testRoot;
        /// The test parameters are the result of hashing together the minimum grade, multiple choice weight and number of questions
        uint256 testParameters;
        /// The non passing test parameters are the result of hashing together a minimum grade set to zero, multiple choice weight and number of questions
        uint256 nonPassingTestParameters;
    }

    /// It defines all the test group parameters
    struct TestGroup {
        /// Leaf index of the next empty credentials tree leaf
        uint80 credentialsTreeIndex;
        /// Leaf index of the next empty no-credentials tree leaf
        uint80 noCredentialsTreeIndex;
        /// Leaf index of the next empty grade tree leaf
        uint80 gradeTreeIndex;
        /// Root hash of the grade tree
        uint256 gradeTreeRoot;
        /// Root hash of the credentials tree
        uint256 credentialsTreeRoot;
        /// Root hash of the no credentials tree root
        uint256 noCredentialsTreeRoot;
        /// Creation timestamp for the different Merkle roots the group gets
        mapping(uint256 => uint256) merkleRootCreationDates;
        /// Used nullifier hashes when generating Semaphore inclusion/grade claim proofs
        mapping(uint256 => bool) nullifierHashes;
    }

    /// It defines the test rating
    struct TestRating {
        /// Sum of all the ratings the credential has received
        uint128 totalRating;
        /// Number of times the credential has been rated
        uint128 nRatings;
    }

    /// @dev Emitted when a test is created
    /// @param testId: id of the test
    event TestCreated(uint256 indexed testId);

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
    /// @param gradeCommitment: new grade commitment added to the grade tree
    event CredentialsNotGained(uint256 indexed testId, uint256 indexed identityCommitment, uint256 gradeCommitment);

    /// @dev Emitted when a rating is given to a credential issuer
    /// @param testId: id of the test
    /// @param admin: address that controls the credential
    /// @param rating: rating given to the credential issuer for this test
    /// @param comment: comment given to the credential issuer for this test
    event NewRating(uint256 indexed testId, address indexed admin, uint256 rating, string comment);

    /// @dev Creates a new test with the test parameters as specified in the `Test` struct
    /// @param minimumGrade: see the `Test` struct
    /// @param multipleChoiceWeight: see the `Test` struct
    /// @param nQuestions: see the `Test` struct
    /// @param timeLimit: see the `Test` struct
    /// @param multipleChoiceRoot: see the `Test` struct
    /// @param openAnswersHashesRoot: see the `Test` struct
    /// @param testURI: external resource containing the actual test and more information about the credential.
    function createTest(
        uint8 minimumGrade,
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint32 timeLimit,
        uint256 multipleChoiceRoot,
        uint256 openAnswersHashesRoot,
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

    /// @dev Invalidates the test so that it is no longer solvable by anyone by setting its minimum grade to 255
    /// @param testId: id of the test
    function invalidateTest(uint256 testId) external;

    /// @dev If the given proof of knowledge of the solution is valid, adds the identityCommitment to the credentialsTree; 
    /// otherwise, it adds the identityCommitment to the no-credentials tree. In either case, the gradeCommitment gets
    /// added to the grade tree.
    /// @param testId: id of the test
    /// @param identityCommitment: new identity commitment to add to the identity tree (credentials or no credentials tree)
    /// @param newIdentityTreeRoot: new root of the identity tree result of adding the identity commitment (credentials or no credentials tree)
    /// @param gradeCommitment: new grade commitment to add to the grade tree
    /// @param newGradeTreeRoot: new root of the grade tree result of adding the grade commitment
    /// @param proof: SNARK proof
    /// @param testPassed: boolean value indicating whether the proof provided corresponds to a passed test or not
    function solveTest(
        uint256 testId,
        uint256 identityCommitment,
        uint256 newIdentityTreeRoot,
        uint256 gradeCommitment,
        uint256 newGradeTreeRoot,
        uint256[8] calldata proof,
        bool testPassed
    ) external;

    /// @dev Proves ownership of a credential and gives a rating to a credential issuer
    /// @param testId: id of the test for which the rating is being done
    /// @param rating: rating given to the credential issuer for this test, 0-100
    /// @param comment: comment given to the credential issuer for this test, maximum 280 characters
    /// @param merkleTreeRoot: root of the Merkle tree
    /// @param nullifierHash: nullifier hash
    /// @param proof: Semaphore zero-knowledge proof
    function rateIssuer(
        uint256 testId,
        uint128 rating,
        string calldata comment,
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external;

    /// @dev Returns the average rating that a test has obtained
    /// @param testId: id of the test
    /// @return average rating the test received
    function getTestAverageRating(uint256 testId) external view returns(uint256);

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
    function getopenAnswersHashesRoot(uint256 testId) external view returns (uint256);

    /// @dev Returns the open answer hashes of the test
    /// @param testId: id of the test
    /// @return Open answer hashes
    function getOpenAnswersHashes(uint256 testId) external view returns (uint256[] memory);

    /// @dev Returns the test root, testRoot = Poseidon(multipleChoiceRoot, openAnswersHashesRoot)
    /// @param testId: id of the test
    /// @return Hash of the multiple choice root and the open answers root
    function getTestRoot(uint256 testId) external view returns (uint256);
    
    /// @dev Returns the test parameters, testParameters = Poseidon(minimumGrade, multipleChoiceWeight, nQuestions)
    /// @param testId: id of the test
    /// @return Hash of the minimum grade, multiple choice weight and the number of questions
    function getTestParameters(uint256 testId) external view returns (uint256);

    /// @dev Returns the non passing test parameters, nonPassingTestParameters = Poseidon(0, multipleChoiceWeight, nQuestions)
    /// @param testId: id of the test
    /// @return Hash of the minimum grade set to 0, multiple choice weight and the number of questions
    function getNonPassingTestParameters(uint256 testId) external view returns (uint256);

    /// @dev Returns the timestamp when the given Merkle root was validated for a given testId
    /// @param testId: id of the test
    /// @param merkleRoot: Merkle root of interest
    function getMerkleRootCreationDate(uint256 testId, uint256 merkleRoot) external view returns (uint256);

    /// @dev Returns whether a nullifier hash was already voided for a given testId
    /// @param testId: id of the test
    /// @param nullifierHash: nullifier hash of interest
    function wasNullifierHashUsed(uint256 testId, uint256 nullifierHash) external view returns (bool);

    /// @dev Returns whether the test exists
    /// @param testId: id of the test
    /// @return Test existence
    function testExists(uint256 testId) external view returns (bool);

    /// @dev Returns whether the test is valid, that is, if it exists and can be solved 
    /// @param testId: id of the test
    /// @return Test validity
    function testIsValid(uint256 testId) external view returns (bool);
}
