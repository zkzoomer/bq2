// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import "../interfaces/ICredentials.sol";
import "../interfaces/IGradeUpdateVerifier.sol";
import "../interfaces/ITestVerifier.sol";
import { PoseidonT3, PoseidonT4 } from "../lib/Poseidon.sol";

contract Credentials is ICredentials, ISemaphoreGroups, Context {
    // TODO: define these ones
    uint256 TREE_DEPTH = 16;
    uint256 EMPTY_LEAF = 0;
    uint256 EMPTY_ROOT = 0;

    uint256 MAX_LEAVES = 2 ** TREE_DEPTH;

    /// @dev Gets a test id and returns the test parameters
    mapping(uint256 => Test) public tests;

    /// @dev Gets a test id and returns the corresponding group parameters
    mapping(uint256 => TestGroup) public testGroups;

    /// @dev Gets a test id and returns the list of open answer hashes
    mapping(uint256 => uint256[]) public openAnswersHashes;

    /// @dev Gets a test id and returns its URI: 
    /// an external resource containing the actual test and more information about the credential
    mapping(uint256 => string) public testURIs;

    /// @dev TestVerifier smart contract
    ITestVerifier testVerifier;
    /// @dev GradeUpdateVerifier smart contract
    IGradeUpdateVerifier gradeUpdateVerifier;

    /// @dev Number of tests that have been created
    uint256 private _nTests;

    /// @dev Checks if the test admin is the transaction sender
    /// @param testId: Id of the test (Semaphore group)
    modifier onlyTestAdmin(uint256 testId) {
        if (tests[testId].admin != _msgSender()) {
            revert CallerIsNotTheTestAdmin();
        }
        _;
    }

    /// @dev Initializes the Credentials smart contract
    /// @param _testVerifier: address of the TestVerifier contract
    /// @param _gradeUpdateVerifier: address of the GradeUpdateVerifier contract
    constructor(
        address _testVerifier,
        address _gradeUpdateVerifier
    ) {
        testVerifier = ITestVerifier(_testVerifier);
        gradeUpdateVerifier = IGradeUpdateVerifier(_gradeUpdateVerifier);
    }

    /// @dev See {ICredentials-createTest}
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
    ) external override {
        // If time and credential limits are set to zero then these limits on solving do not get enforced
        // credential limits would still get enforced when adding to the corresponding trees
        if (timeLimit > block.timestamp || timeLimit == 0) {
            revert TimeLimitIsInThePast();
        }
        if (nQuestions >= 1 && nQuestions <= 64) {
            revert InvalidNumberOfQuestions();
        }
        if (minimumGrade <= 100) {
            revert InvalidMinimumGrade();
        }
        if (multipleChoiceWeight > 100) {
            revert InvalidMultipleChoiceWeight();
        }
        if (credentialLimit > MAX_LEAVES) {
            revert InvalidCredentialLimit();
        }

        _nTests++;
        
        tests[_nTests] = Test(
            multipleChoiceWeight,
            nQuestions,
            minimumGrade,
            credentialLimit,
            timeLimit,
            admin,
            multipleChoiceRoot,
            openAnswersRoot,
            PoseidonT3.poseidon([multipleChoiceRoot, openAnswersRoot]),
            PoseidonT4.poseidon([uint256(minimumGrade), uint256(multipleChoiceWeight), uint256(nQuestions)])
        );

        testGroups[_nTests] = TestGroup(
            1,
            1,
            EMPTY_ROOT,
            EMPTY_ROOT,
            EMPTY_ROOT
        );

        testURIs[_nTests] = testURI;

        emit TestCreated(_nTests);

        emit TestAdminUpdated(_nTests, address(0), admin);
    }       

    /// @dev See {ICredentials-verifyTestAnswers}
    function verifyTestAnswers(
        uint256 testId,
        uint256[] memory answerHashes
    ) external override {
        if (tests[testId].multipleChoiceWeight == 100) {
            // A multiple choice test already has their test answers "verified", as these do not exist
            revert TestAnswersAlreadyVerified();
        }
        if (tests[testId].nQuestions != answerHashes.length) {
            revert InvalidTestAnswersLength(tests[testId].nQuestions, answerHashes.length);
        }

        openAnswersHashes[testId] = answerHashes;
    }

    /// @dev See {ICredentials-updateTestAdmin}
    function updateTestAdmin(uint256 testId, address newAdmin) external override onlyTestAdmin(testId) {
        tests[testId].admin = newAdmin;

        emit TestAdminUpdated(testId, tests[testId].admin, newAdmin);
    }

    /// @dev See {ICredentials-invalidateTest}
    function invalidateTest(uint256 testId) external override onlyTestAdmin(testId) {
        if (tests[testId].minimumGrade == 255) {
            revert TestAlreadyInvalid();
        }

        tests[testId].minimumGrade = 255;

        emit TestInvalidated(testId);
    }

    /// @dev See {ICredentials-solveTest}
    function solveTest(
        uint256 testId,
        uint256[10] calldata input,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external override {
        if (tests[testId].testRoot != input[8]) {
            revert InvalidTestRoot(tests[testId].testRoot, input[8]);
        }
        if (!testVerifier.verifyProof(proofA, proofB, proofC, input)) {
            revert SolutionIsNotValid();
        }

        // Passing grade / non passing grade / invalid condition
        if (tests[testId].testParameters == input[9]) {  
            if (testGroups[testId].credentialsTreeIndex != input[0]) {
                revert InvalidTreeIndex(testGroups[testId].credentialsTreeIndex, input[0]);
            }
            if (testGroups[testId].credentialsTreeIndex != input[4]) {
                revert InvalidTreeIndex(testGroups[testId].credentialsTreeIndex, input[4]);
            }

            if (testGroups[testId].credentialsTreeRoot != input[2]) {
                revert InvalidTreeRoot(testGroups[testId].credentialsTreeRoot, input[2]);
            }
            if (testGroups[testId].gradeTreeRoot != input[6]) {
                revert InvalidTreeRoot(testGroups[testId].gradeTreeRoot, input[6]);
            }

            testGroups[testId].credentialsTreeIndex += 1;

            testGroups[testId].credentialsTreeRoot = input[3];

            testGroups[testId].gradeTreeRoot = input[7];

            // Member added to credentials tree
            emit MemberAdded(
                testId,    // groupId
                input[0],  // index
                input[1],  // identityCommitment
                input[3]   // merkleTreeRoot
            );
            // Member added to grade tree
            emit MemberAdded(
                testId,    // groupId
                input[5],  // index
                input[5],  // identityCommitment
                input[7]   // merkleTreeRoot
            );

            emit CredentialsGained(
                testId,    // testId
                input[1],  // identityCommitment
                input[5]   // gradeCommitment
            );
        } else if (PoseidonT4.poseidon([0, uint256(tests[testId].multipleChoiceWeight), uint256(tests[testId].nQuestions)]) == input[9]) {
            if (testGroups[testId].noCredentialsTreeIndex != input[0]) {
                revert InvalidTreeIndex(testGroups[testId].noCredentialsTreeIndex, input[0]);
            }

            if (testGroups[testId].noCredentialsTreeRoot != input[2]) {
                revert InvalidTreeRoot(testGroups[testId].noCredentialsTreeRoot, input[2]);
            }

            testGroups[testId].noCredentialsTreeIndex += 1;

            testGroups[testId].noCredentialsTreeRoot = input[3];

            // Member added to no credentials tree
            emit MemberAdded(
                testId,    // groupId
                input[0],  // index
                input[1],  // identityCommitment
                input[3]   // merkleTreeRoot
            );

            emit CredentialsNotGained(
                testId,   // testId
                input[1]  // identityCommitment
            );
        } else {
            revert InvalidTestParameters(tests[testId].testParameters, input[9]);
        }
    }

    /// @dev See {ICredentials-updateGrade}
    function updateGrade(
        uint256 testId,
        uint256[7] calldata input,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external override {
        if (tests[testId].testRoot != input[5]) {
            revert InvalidTestRoot(tests[testId].testRoot, input[5]);
        }
        if (!gradeUpdateVerifier.verifyProof(proofA, proofB, proofC, input)) {
            revert SolutionIsNotValid();
        }

        if (tests[testId].testParameters != input[6]) {
            revert InvalidTestParameters(tests[testId].testParameters, input[6]);
        }

        if (testGroups[testId].gradeTreeRoot != input[3]) {
            revert InvalidTreeRoot(testGroups[testId].gradeTreeRoot, input[3]);
        }

        testGroups[testId].gradeTreeRoot = input[4];

        emit MemberUpdated(
            testId,    // groupId
            input[0],  // index
            input[1],  // identityCommitment
            input[2],  // newIdentityCommitment
            input[4]   // merkleTreeRoot
        );
    }

    /// @dev See {ICredentials-getTest}
    function getTest(uint256 testId) external view override returns (Test memory) {
        return tests[testId];
    }

    /// @dev See {ICredentials-getTestURI}
    function getTestURI(uint256 testId) external view override returns (string memory) {
        return testURIs[testId];
    }

    /// @dev See {ICredentials-getMultipleChoiceRoot}
    function getMultipleChoiceRoot(uint256 testId) external view override returns (uint256) {
        return tests[testId].multipleChoiceRoot;
    }

    /// @dev See {ICredentials-getOpenAnswersRoot}
    function getOpenAnswersRoot(uint256 testId) external view override returns (uint256) {
        return tests[testId].openAnswersRoot;
    }

    /// @dev See {ICredentials-getOpenAnswersHashes}
    function getOpenAnswersHashes(uint256 testId) external view override returns (uint256[] memory) {
        return openAnswersHashes[testId];
    }

    /// @dev See {ICredentials-getTestRoot}
    function getTestRoot(uint256 testId) external view override returns (uint256) {
        return tests[testId].testRoot;
    }

    /// @dev See {ICredentials-getTestParameters}
    function getTestParameters(uint256 testId) external view override returns (uint256) {
        return tests[testId].testParameters;
    }

    /// @dev See {ICredentials-testExists}
    function testExists(uint256 testId) external view override returns (bool) {
        return testId <= _nTests;
    }

    /// @dev See {ICredentials-testIsValid}
    function testIsValid(uint256 testId) external view override returns (bool) {
        return tests[testId].minimumGrade == 255;
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeRoot}
    /// Returns the root of the credentialsTree for this testId, which works as our groupId
    function getMerkleTreeRoot(uint256 testId) external view override returns (uint256) {
        return testGroups[testId].credentialsTreeRoot;
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeDepth}
    /// Returns the depth of the credentialsTree for this testId, which works as our groupId
    function getMerkleTreeDepth(uint256 /* testId */) external view override returns (uint256) {
        // Independent of the testId
        return TREE_DEPTH;
    }
    
    /// @dev See {ISemaphoreGroups-getNumberOfMerkleTreeLeaves}
    /// Returns the number of non-empty leaves of the credentialsTree for this testId, which works as our groupId
    function getNumberOfMerkleTreeLeaves(uint256 testId) external view override returns (uint256) {
        return testGroups[testId].credentialsTreeIndex - 1;
    }

    /// @dev See {ICredentials-getGradeTreeRoot}
    function getGradeTreeRoot(uint256 testId) external view override returns (uint256) {
        return testGroups[testId].gradeTreeRoot;
    }

    /// @dev See {ICredentials-getNoCredentialsTreeRoot}
    function getNoCredentialsTreeRoot(uint256 testId) external view override returns (uint256) {
        return testGroups[testId].noCredentialsTreeRoot;
    }

    /// @dev See {ICredentials-getNumberOfNoCredentialsTreeLeaves}
    function getNumberOfNoCredentialsTreeLeaves(uint256 testId) external view override returns (uint256) {
        return testGroups[testId].noCredentialsTreeIndex - 1;
    }
}
