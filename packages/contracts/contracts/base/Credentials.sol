// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import "../interfaces/ICredentials.sol";
import "../interfaces/ITestVerifier.sol";
import { PoseidonT3, PoseidonT4 } from "../lib/Poseidon.sol";

contract Credentials is ICredentials, ISemaphoreGroups, Context {
    uint256 TREE_DEPTH = 16;
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

    /// @dev Checks if the test exists
    /// @param testId: Id of the test (Semaphore group)
    modifier onlyExistingTests(uint256 testId) {
        if (!_testExists(testId)) {
            revert TestDoesNotExist();
        }
        _;
    }

    /// @dev Initializes the Credentials smart contract
    /// @param _testVerifier: address of the TestVerifier contract
    constructor(
        address _testVerifier
    ) {
        testVerifier = ITestVerifier(_testVerifier);
    }

    /// @dev See {ICredentials-createTest}
    function createTest(
        uint8 minimumGrade,
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint32 timeLimit,
        address admin,
        uint256 multipleChoiceRoot,
        uint256 openAnswersHashesRoot,
        string memory testURI
    ) external override {
        // If time and credential limits are set to zero then these limits on solving do not get enforced
        // credential limits would still get enforced when adding to the corresponding trees
        if (timeLimit < block.timestamp && timeLimit != 0) {
            revert TimeLimitIsInThePast();
        }

        if (nQuestions > 64 || nQuestions == 0 ) {
            revert InvalidNumberOfQuestions();
        }

        if (minimumGrade > 100) {
            revert InvalidMinimumGrade();
        }

        if (multipleChoiceWeight > 100) {
            revert InvalidMultipleChoiceWeight();
        }

        uint256 zeroValue = uint256(keccak256(abi.encodePacked(_nTests))) >> 8;

        for (uint8 i = 0; i < TREE_DEPTH; ) {
            zeroValue = PoseidonT3.poseidon([zeroValue, zeroValue]);

            unchecked {
                ++i;
            }
        }

        tests[_nTests] = Test(
            minimumGrade,
            multipleChoiceWeight,
            nQuestions,
            timeLimit,
            admin,
            multipleChoiceRoot,
            openAnswersHashesRoot,
            PoseidonT3.poseidon([multipleChoiceRoot, openAnswersHashesRoot]),
            PoseidonT4.poseidon([uint256(minimumGrade), uint256(multipleChoiceWeight), uint256(nQuestions)])
        );

        testGroups[_nTests] = TestGroup(
            0,
            0,
            0,
            zeroValue,
            zeroValue,
            zeroValue
        );

        testURIs[_nTests] = testURI;

        emit TestCreated(_nTests);

        emit TestAdminUpdated(_nTests, address(0), admin);

        _nTests++;
    }       

    /// @dev See {ICredentials-verifyTestAnswers}
    function verifyTestAnswers(
        uint256 testId,
        uint256[] memory answerHashes
    ) external override onlyExistingTests(testId) onlyTestAdmin(testId) {
        if (tests[testId].multipleChoiceWeight == 100 || openAnswersHashes[testId].length != 0) {
            // A multiple choice test already has their test answers "verified", as these do not exist
            revert TestAnswersAlreadyVerified();
        }

        if (tests[testId].nQuestions != answerHashes.length) {
            revert InvalidTestAnswersLength(tests[testId].nQuestions, answerHashes.length);
        }

        openAnswersHashes[testId] = answerHashes;
    }

    /// @dev See {ICredentials-updateTestAdmin}
    function updateTestAdmin(
        uint256 testId, 
        address newAdmin
    ) external override onlyExistingTests(testId) onlyTestAdmin(testId) {
        tests[testId].admin = newAdmin;

        emit TestAdminUpdated(testId, tests[testId].admin, newAdmin);
    }

    /// @dev See {ICredentials-invalidateTest}
    function invalidateTest(
        uint256 testId
    ) external override onlyExistingTests(testId) onlyTestAdmin(testId) {
        if (tests[testId].minimumGrade == 255) {
            revert TestWasInvalidated();
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
    ) external override onlyExistingTests(testId) {
        if (tests[testId].minimumGrade == 255) {
            revert TestWasInvalidated();
        }

        if (tests[testId].timeLimit != 0 && block.timestamp > tests[testId].timeLimit) {
            revert TimeLimitReached();
        }

        if (tests[testId].testRoot != input[8]) {
            revert InvalidTestRoot(tests[testId].testRoot, input[8]);
        }

        if (testGroups[testId].gradeTreeIndex != input[4]) {
            revert InvalidTreeIndex(testGroups[testId].credentialsTreeIndex, input[4]);
        }

        // Passing grade / non passing grade / invalid condition
        if (tests[testId].testParameters == input[9]) {  
            if (testGroups[testId].credentialsTreeIndex != input[0]) {
                revert InvalidTreeIndex(testGroups[testId].credentialsTreeIndex, input[0]);
            }

            if (testGroups[testId].credentialsTreeRoot != input[2]) {
                revert InvalidTreeRoot(testGroups[testId].credentialsTreeRoot, input[2]);
            }

            if (testGroups[testId].gradeTreeRoot != input[6]) {
                revert InvalidTreeRoot(testGroups[testId].gradeTreeRoot, input[6]);
            }
            
            if (!testVerifier.verifyProof(proofA, proofB, proofC, input)) {
                revert SolutionIsNotValid();
            }

            testGroups[testId].credentialsTreeIndex += 1;

            testGroups[testId].credentialsTreeRoot = input[3];

            // Member added to credentials tree
            emit MemberAdded(
                3 * testId + 1,  // groupId
                input[0],        // index
                input[1],        // identityCommitment
                input[3]         // credentialsTreeRoot
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

            if (!testVerifier.verifyProof(proofA, proofB, proofC, input)) {
                revert SolutionIsNotValid();
            }

            testGroups[testId].noCredentialsTreeIndex += 1;

            testGroups[testId].noCredentialsTreeRoot = input[3];

            // Member added to no credentials tree
            emit MemberAdded(
                3 * testId + 2,  // groupId
                input[0],        // index
                input[1],        // identityCommitment
                input[3]         // noCredentialsTreeRoot
            );

            emit CredentialsNotGained(
                testId,    // testId
                input[1],  // identityCommitment
                input[5]   // gradeCommitment
            );
        } else {
            revert InvalidTestParameters(tests[testId].testParameters, input[9]);
        }

        // Member always gets added to grade tree
        testGroups[testId].gradeTreeIndex += 1;
        testGroups[testId].gradeTreeRoot = input[7];

        emit MemberAdded(
            3 * testId,  // groupId
            input[4],    // index
            input[5],    // gradeCommitment
            input[7]     // gradeTreeRoot
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

    /// @dev See {ICredentials-getopenAnswersHashesRoot}
    function getopenAnswersHashesRoot(uint256 testId) external view override returns (uint256) {
        return tests[testId].openAnswersHashesRoot;
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
        return _testExists(testId);
    }

    /// @dev See {ICredentials-testIsValid}
    function testIsValid(uint256 testId) external view override returns (bool) {
        return _testExists(testId) && tests[testId].minimumGrade != 255;
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeRoot}
    function getMerkleTreeRoot(uint256 groupId) external view override returns (uint256) {
        uint256 testId = groupId / 3;
        if (groupId % 3 == 0) {
            return testGroups[testId].gradeTreeRoot;
        } else if (groupId % 3 == 1) {
            return testGroups[testId].credentialsTreeRoot;
        } else {  // groupId % 3 == 2
            return testGroups[testId].noCredentialsTreeRoot;
        }
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeDepth}
    function getMerkleTreeDepth(uint256 /* testId */) external view override returns (uint256) {
        // Independent of the testId
        return TREE_DEPTH;
    }
    
    /// @dev See {ISemaphoreGroups-getNumberOfMerkleTreeLeaves}
    function getNumberOfMerkleTreeLeaves(uint256 groupId) external view override returns (uint256) {
        uint256 testId = groupId / 3;
        if (groupId % 3 == 0) {
            return uint256(testGroups[testId].gradeTreeIndex);
        } else if (groupId % 3 == 1) {
            return uint256(testGroups[testId].credentialsTreeIndex);
        } else {  // groupId % 3 == 2
            return uint256(testGroups[testId].noCredentialsTreeIndex);
        }
    }

    /// @dev Returns whether the test exists
    /// @param testId: id of the test
    /// @return Test existence
    function _testExists(uint256 testId) internal view virtual returns (bool) {
        return testId < _nTests;
    }
}
