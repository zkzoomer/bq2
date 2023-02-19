// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";
import "../interfaces/ICredentials.sol";
import "../verifiers/TestVerifier.sol";
import "../verifiers/GradeClaimVerifier.sol";
import { PoseidonT3, PoseidonT4 } from "../lib/Poseidon.sol";

contract Credentials is ICredentials, ISemaphoreGroups, Context {
    uint256 constant MAX_QUESTIONS = 2 ** 6;
    uint256 constant N_LEVELS = 16;
    uint256 constant MERKLE_TREE_DURATION = 15 minutes;

    /// @dev Gets a test id and returns the test parameters
    mapping(uint256 => Test) public tests;

    /// @dev Gets a test id and returns the corresponding group parameters
    mapping(uint256 => TestGroup) public testGroups;

    /// @dev Gests a test id and returns the corresponding ratings received
    mapping(uint256 => TestRating) public testRatings;

    /// @dev Gets a test id and returns the list of open answer hashes
    mapping(uint256 => uint256[]) public openAnswersHashes;

    /// @dev Gets a test id and returns its URI: 
    /// an external resource containing the actual test and more information about the credential
    mapping(uint256 => string) public testURIs;

    /// @dev SemaphoreVerifier smartcontract
    ISemaphoreVerifier public semaphoreVerifier;
    /// @dev TestVerifier smart contract
    ITestVerifier public testVerifier;
    /// @dev GradeClaimVerifier smart contract
    IGradeClaimVerifier public gradeClaimVerifier;

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
/*     /// @param _semaphoreVerifier: contract address of the SemaphoreVerifier contract
 */    constructor(
        address _semaphoreVerifier
    ) {
        semaphoreVerifier = ISemaphoreVerifier(_semaphoreVerifier);
        testVerifier = new TestVerifier();
        gradeClaimVerifier = new GradeClaimVerifier();
    }

    /// @dev See {ICredentials-createTest}
    function createTest(
        uint8 minimumGrade,
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint32 timeLimit,
        uint256 multipleChoiceRoot,
        uint256 openAnswersHashesRoot,
        string memory testURI
    ) external override {
        // If time and credential limits are set to zero then these limits on solving do not get enforced
        // credential limits would still get enforced when adding to the corresponding trees
        if (timeLimit < block.timestamp && timeLimit != 0) {
            revert TimeLimitIsInThePast();
        }

        if (nQuestions > MAX_QUESTIONS || nQuestions == 0 ) {
            revert InvalidNumberOfQuestions();
        }

        if (minimumGrade > 100) {
            revert InvalidMinimumGrade();
        }

        if (multipleChoiceWeight > 100) {
            revert InvalidMultipleChoiceWeight();
        }

        uint256 zeroValue = uint256(keccak256(abi.encodePacked(_nTests))) >> 8;

        for (uint8 i = 0; i < N_LEVELS; ) {
            zeroValue = PoseidonT3.poseidon([zeroValue, zeroValue]);

            unchecked {
                ++i;
            }
        }

        uint256 testParameters = PoseidonT4.poseidon([uint256(minimumGrade), uint256(multipleChoiceWeight), uint256(nQuestions)]);
        uint256 nonPassingTestParameters;

        if (minimumGrade != 0) {
            nonPassingTestParameters = PoseidonT4.poseidon([uint256(0), uint256(multipleChoiceWeight), uint256(nQuestions)]);
        } else {
            nonPassingTestParameters = testParameters;
        }

        tests[_nTests] = Test(
            minimumGrade,
            multipleChoiceWeight,
            nQuestions,
            timeLimit,
            _msgSender(),
            multipleChoiceRoot,
            openAnswersHashesRoot,
            PoseidonT3.poseidon([multipleChoiceRoot, openAnswersHashesRoot]),
            testParameters,
            nonPassingTestParameters
        );

        testGroups[_nTests].credentialsTreeIndex = 0;
        testGroups[_nTests].noCredentialsTreeIndex = 0;
        testGroups[_nTests].gradeTreeIndex = 0;
        testGroups[_nTests].gradeTreeRoot = zeroValue;
        testGroups[_nTests].credentialsTreeRoot = zeroValue;
        testGroups[_nTests].noCredentialsTreeRoot = zeroValue;

        testURIs[_nTests] = testURI;

        emit TestCreated(_nTests);

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
        uint256 identityCommitment,
        uint256 newIdentityTreeRoot,
        uint256 gradeCommitment,
        uint256 newGradeTreeRoot,
        uint256[8] calldata proof,
        bool testPassed
    ) external override onlyExistingTests(testId) {
        if (tests[testId].minimumGrade == 255) {
            revert TestWasInvalidated();
        }

        if (tests[testId].timeLimit != 0 && block.timestamp > tests[testId].timeLimit) {
            revert TimeLimitReached();
        }

        if (testPassed || tests[testId].minimumGrade == 0) {  // test always gets passed when minimumGrade = 0
            uint[10] memory proofInput = [
                testGroups[testId].credentialsTreeIndex,
                identityCommitment,
                testGroups[testId].credentialsTreeRoot,
                newIdentityTreeRoot,
                testGroups[testId].gradeTreeIndex,
                gradeCommitment,
                testGroups[testId].gradeTreeRoot,
                newGradeTreeRoot,
                tests[testId].testRoot,
                tests[testId].testParameters
            ];

            if (!testVerifier.verifyProof(proof, proofInput)) {
                revert SolutionIsNotValid();
            }

            // Member added to credentials tree
            emit MemberAdded(
                3 * testId + 1,                           // groupId
                testGroups[testId].credentialsTreeIndex,  // index
                identityCommitment,                       // identityCommitment
                newIdentityTreeRoot                       // credentialsTreeRoot
            );

            emit CredentialsGained(
                testId,              // testId
                identityCommitment,  // identityCommitment
                gradeCommitment      // gradeCommitment
            );
            
            testGroups[testId].credentialsTreeIndex += 1;
            testGroups[testId].credentialsTreeRoot = newIdentityTreeRoot;
        } else {
            uint[10] memory proofInput = [
                testGroups[testId].noCredentialsTreeIndex,
                identityCommitment,
                testGroups[testId].noCredentialsTreeRoot,
                newIdentityTreeRoot,
                testGroups[testId].gradeTreeIndex,
                gradeCommitment,
                testGroups[testId].gradeTreeRoot,
                newGradeTreeRoot,
                tests[testId].testRoot,
                tests[testId].nonPassingTestParameters
            ];

            if (!testVerifier.verifyProof(proof, proofInput)) {
                revert SolutionIsNotValid();
            }

            // Member added to no credentials tree
            emit MemberAdded(
                3 * testId + 2,                             // groupId
                testGroups[testId].noCredentialsTreeIndex,  // index
                identityCommitment,                         // identityCommitment
                newIdentityTreeRoot                         // noCredentialsTreeRoot
            );

            emit CredentialsNotGained(
                testId,              // testId
                identityCommitment,  // identityCommitment
                gradeCommitment      // gradeCommitment
            );

            testGroups[testId].noCredentialsTreeIndex += 1;
            testGroups[testId].noCredentialsTreeRoot = newIdentityTreeRoot;
        }
        
        // Member always gets added to grade tree
        emit MemberAdded(
            3 * testId,                         // groupId
            testGroups[testId].gradeTreeIndex,  // index
            gradeCommitment,                    // gradeCommitment
            newGradeTreeRoot                    // gradeTreeRoot
        );

        testGroups[testId].gradeTreeIndex += 1;
        testGroups[testId].gradeTreeRoot = newGradeTreeRoot;
        testGroups[testId].merkleRootCreationDates[newIdentityTreeRoot] = block.timestamp;
        testGroups[testId].merkleRootCreationDates[newGradeTreeRoot] = block.timestamp;
    }

    /// @dev See {ICredentials-rateIssuer}
    function rateIssuer(
        uint256 testId,
        uint128 rating,
        string calldata comment,
        uint256 merkleTreeRoot,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external override onlyExistingTests(testId) {
        if(rating > 100) {
            revert InvalidRating();
        }

        uint256 signal = uint(keccak256(abi.encode(rating, comment)));
        uint256 externalNullifier = 0x62712d7261746500000000000000000000000000000000000000000000000000;  // formatBytes32String("bq-rate")

        // A proof could have used an old Merkle tree root.
        // https://github.com/semaphore-protocol/semaphore/issues/98
        if (merkleTreeRoot != testGroups[testId].credentialsTreeRoot) {
            uint256 merkleRootCreationDate = testGroups[testId].merkleRootCreationDates[merkleTreeRoot];

            if (merkleRootCreationDate == 0) {
                revert MerkleTreeRootIsNotPartOfTheGroup();
            }

            if (block.timestamp > merkleRootCreationDate + MERKLE_TREE_DURATION) {
                revert MerkleTreeRootIsExpired();
            }
        }

        if (testGroups[testId].nullifierHashes[nullifierHash]) {
            revert UsingSameNullifierTwice();
        }

        semaphoreVerifier.verifyProof(merkleTreeRoot, nullifierHash, signal, externalNullifier, proof, N_LEVELS);

        testGroups[testId].nullifierHashes[nullifierHash] = true;
        testRatings[testId].totalRating += rating;
        testRatings[testId].nRatings++;

        emit NewRating(testId, tests[testId].admin, rating, comment);
    }

    /// @dev See {ICredentials-getTestAverageRating}
    function getTestAverageRating(uint256 testId) external view override onlyExistingTests(testId) returns (uint256) {
        uint256 nRatings = testRatings[testId].nRatings;
        return nRatings == 0 ? nRatings : testRatings[testId].totalRating / nRatings;
    }

    /// @dev See {ICredentials-getTest}
    function getTest(uint256 testId) external view override onlyExistingTests(testId) returns (Test memory)  {
        return tests[testId];
    }

    /// @dev See {ICredentials-getTestURI}
    function getTestURI(uint256 testId) external view override onlyExistingTests(testId) returns (string memory) {
        return testURIs[testId];
    }

    /// @dev See {ICredentials-getMultipleChoiceRoot}
    function getMultipleChoiceRoot(uint256 testId) external view override onlyExistingTests(testId) returns (uint256) {
        return tests[testId].multipleChoiceRoot;
    }

    /// @dev See {ICredentials-getopenAnswersHashesRoot}
    function getopenAnswersHashesRoot(uint256 testId) external view override onlyExistingTests(testId) returns (uint256) {
        return tests[testId].openAnswersHashesRoot;
    }

    /// @dev See {ICredentials-getOpenAnswersHashes}
    function getOpenAnswersHashes(uint256 testId) external view override onlyExistingTests(testId) returns (uint256[] memory) {
        return openAnswersHashes[testId];
    }

    /// @dev See {ICredentials-getTestRoot}
    function getTestRoot(uint256 testId) external view override onlyExistingTests(testId) returns (uint256) {
        return tests[testId].testRoot;
    }

    /// @dev See {ICredentials-getTestParameters}
    function getTestParameters(uint256 testId) external view override onlyExistingTests(testId) returns (uint256) {
        return tests[testId].testParameters;
    }

    /// @dev See {ICredentials-getNonPassingTestParameters}
    function getNonPassingTestParameters(uint256 testId) external view override onlyExistingTests(testId) returns (uint256) {
        return tests[testId].nonPassingTestParameters;
    }

    /// @dev See {ICredentials-getMerkleRootCreationDate}
    function getMerkleRootCreationDate(uint256 testId, uint256 merkleRoot) external view override onlyExistingTests(testId) returns (uint256 creationDate) {
        creationDate = testGroups[testId].merkleRootCreationDates[merkleRoot];

        if (creationDate == 0) {
            revert MerkleTreeRootIsNotPartOfTheGroup();
        }

        return creationDate;
    }

    /// @dev See {ICredentials-wasNullifierHashUsed}
    function wasNullifierHashUsed(uint256 testId, uint256 nullifierHash) external view override onlyExistingTests(testId) returns (bool) {
        return testGroups[testId].nullifierHashes[nullifierHash];
    }

    /// @dev See {ICredentials-testExists}
    function testExists(uint256 testId) external view override returns (bool) {
        return _testExists(testId);
    }

    /// @dev See {ICredentials-testIsValid}
    function testIsValid(uint256 testId) external view override onlyExistingTests(testId) returns (bool) {
        return _testExists(testId) && tests[testId].minimumGrade != 255;
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeRoot}
    function getMerkleTreeRoot(uint256 groupId) external view override onlyExistingTests(groupId/3) returns (uint256) {
        uint256 testId = groupId/3;
        if (groupId % 3 == 0) {
            return testGroups[testId].gradeTreeRoot;
        } else if (groupId % 3 == 1) {
            return testGroups[testId].credentialsTreeRoot;
        } else {  // groupId % 3 == 2
            return testGroups[testId].noCredentialsTreeRoot;
        }
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeDepth}
    function getMerkleTreeDepth(uint256 /* testId */) external pure override returns (uint256) {
        // Independent of the testId
        return N_LEVELS;
    }
    
    /// @dev See {ISemaphoreGroups-getNumberOfMerkleTreeLeaves}
    function getNumberOfMerkleTreeLeaves(uint256 groupId) external view override onlyExistingTests(groupId/3) returns (uint256) {
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
