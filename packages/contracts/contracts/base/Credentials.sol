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
    uint256 public nTests;

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
    /// @param _semaphoreVerifier: contract address of the SemaphoreVerifier contract
    constructor(
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
        _createTest(minimumGrade, multipleChoiceWeight, nQuestions, timeLimit, 0, 0, multipleChoiceRoot, openAnswersHashesRoot, testURI);
    }    

    /// @dev See {ICredentials-createCredentialRestrictedTest}
    function createCredentialRestrictedTest(
        uint8 minimumGrade,
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint32 timeLimit,
        uint32 requiredCredential,
        uint256 multipleChoiceRoot,
        uint256 openAnswersHashesRoot,
        string memory testURI
    ) external override onlyExistingTests(requiredCredential) {
        _createTest(minimumGrade, multipleChoiceWeight, nQuestions, timeLimit, requiredCredential, 0, multipleChoiceRoot, openAnswersHashesRoot, testURI);
    }

    /// @dev See {ICredentials-createGradeRestrictedTest}
    function createGradeRestrictedTest(
        uint8 minimumGrade,
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint32 timeLimit,
        uint32 requiredCredential,
        uint8 requiredCredentialGradeThreshold,
        uint256 multipleChoiceRoot,
        uint256 openAnswersHashesRoot,
        string memory testURI
    ) external override onlyExistingTests(requiredCredential) {
        if (requiredCredentialGradeThreshold > 100) {
            revert InvalidRequiredCredentialGradeThreshold();
        }

        _createTest(minimumGrade, multipleChoiceWeight, nQuestions, timeLimit, requiredCredential, requiredCredentialGradeThreshold, multipleChoiceRoot, openAnswersHashesRoot, testURI);
    }

    /// @dev Verifies the test parameters given and creates a new test accordingly
    function _createTest(
        uint8 minimumGrade,
        uint8 multipleChoiceWeight,
        uint8 nQuestions,
        uint32 timeLimit,
        uint32 requiredCredential,
        uint8 requiredCredentialGradeThreshold,
        uint256 multipleChoiceRoot,
        uint256 openAnswersHashesRoot,
        string memory testURI
    ) internal {
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

        nTests++;

        uint256 zeroValue = uint256(keccak256(abi.encodePacked(nTests))) >> 8;

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

        tests[nTests] = Test(
            minimumGrade,
            multipleChoiceWeight,
            nQuestions,
            timeLimit,
            requiredCredential,
            requiredCredentialGradeThreshold,
            _msgSender(),
            multipleChoiceRoot,
            openAnswersHashesRoot,
            PoseidonT3.poseidon([multipleChoiceRoot, openAnswersHashesRoot]),
            testParameters,
            nonPassingTestParameters
        );

        testGroups[nTests].credentialsTreeIndex = 0;
        testGroups[nTests].noCredentialsTreeIndex = 0;
        testGroups[nTests].gradeTreeIndex = 0;
        testGroups[nTests].gradeTreeRoot = zeroValue;
        testGroups[nTests].credentialsTreeRoot = zeroValue;
        testGroups[nTests].noCredentialsTreeRoot = zeroValue;

        testURIs[nTests] = testURI;

        emit TestCreated(nTests);
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
        uint256[8] calldata proof,
        uint256[4] calldata testProofInputs,
        bool testPassed
    ) external override {
        if (tests[testId].requiredCredential != 0 && tests[testId].requiredCredentialGradeThreshold == 0) {
            revert UserMustProveCredentialOwnership(tests[testId].requiredCredential);
        } else if (tests[testId].requiredCredential != 0 && tests[testId].requiredCredentialGradeThreshold != 0) {
            revert UserMustProveGradeThresholdObtained(tests[testId].requiredCredential,tests[testId].requiredCredentialGradeThreshold);
        }
        
        _solveTest(testId, testProofInputs, proof, testPassed);
    }

    /// @dev See {ICredentials-solveCredentialRestrictedTest}
    function solveCredentialRestrictedTest(
        uint256 testId,
        uint256[8] calldata testProof,
        uint256[4] calldata testProofInputs,
        uint256[8] calldata semaphoreProof,
        uint256[2] calldata semaphoreProofInputs,
        bool testPassed
    ) external override {
        uint256 requiredCredentialTestId = tests[testId].requiredCredential;
        if (requiredCredentialTestId == 0) {
            revert CredentialOwnershipProofNotNeeded();
        } else if (requiredCredentialTestId != 0 && tests[testId].requiredCredentialGradeThreshold != 0) {
            revert UserMustProveGradeThresholdObtained(requiredCredentialTestId, tests[testId].requiredCredentialGradeThreshold);
        }

        if (testGroups[requiredCredentialTestId].nullifierHashes[semaphoreProofInputs[1]]) {
            revert UsingSameNullifierTwice();
        }

        _verifyMerkleRootValidity(
            requiredCredentialTestId, 
            semaphoreProofInputs[0], 
            testGroups[requiredCredentialTestId].credentialsTreeRoot
        );

        uint256 signal = uint(keccak256(abi.encode(
            testProofInputs[0], 
            testProofInputs[1], 
            testProofInputs[2], 
            testProofInputs[3]
        )));
        // formatBytes32String("bq-credential-restricted-test")
        uint256 externalNullifier = 0x62712d63726564656e7469616c2d726573747269637465642d74657374000000;

        semaphoreVerifier.verifyProof(semaphoreProofInputs[0], semaphoreProofInputs[1], signal, externalNullifier, semaphoreProof, N_LEVELS);
        
        testGroups[requiredCredentialTestId].nullifierHashes[semaphoreProofInputs[1]] = true;

        _solveTest(testId, testProofInputs, testProof, testPassed);
    }

    /// @dev See {ICredentials-solveGradeRestrictedTest}
    function solveGradeRestrictedTest(
        uint256 testId,
        uint256[8] calldata testProof,
        uint256[4] calldata testProofInputs,
        uint256[8] calldata gradeClaimProof,
        uint256[2] calldata gradeClaimProofInputs,
        bool testPassed
    ) external override {
        // TODO: look into gas savings by doing uint40 & uint8 here and the corresponding casts later
        uint256 requiredCredentialTestId = tests[testId].requiredCredential;
        uint256 requiredCredentialGradeThreshold = tests[testId].requiredCredentialGradeThreshold;
        if (requiredCredentialTestId == 0) {
            revert GradeThresholdProofNotNeeded();
        } else if (requiredCredentialTestId != 0 && requiredCredentialGradeThreshold == 0) {
            revert UserMustProveCredentialOwnership(requiredCredentialTestId);
        }

        if (testGroups[requiredCredentialTestId].nullifierHashes[gradeClaimProofInputs[1]]) {
            revert UsingSameNullifierTwice();
        }

        _verifyMerkleRootValidity(
            requiredCredentialTestId, 
            gradeClaimProofInputs[0], 
            testGroups[requiredCredentialTestId].gradeTreeRoot
        );

        uint256 signal = uint(keccak256(abi.encode(
            testProofInputs[0], 
            testProofInputs[1], 
            testProofInputs[2], 
            testProofInputs[3]
        )));
        // _hash(formatBytes32String("bq-grade-restricted-test")) == _hash(0x62712d67726164652d726573747269637465642d746573740000000000000000)
        uint256 externalNullifierHash = 360726937354500291699366262339606603465379696885406079715828419132989363476;

        // Grade threshold needs to be weighted by the number of questions
        uint256 nQuestions = tests[requiredCredentialTestId].nQuestions;
        uint256 weightedRequiredCredentialGradeThreshold = requiredCredentialGradeThreshold * nQuestions;

        gradeClaimVerifier.verifyProof(
            gradeClaimProof,
            [
                gradeClaimProofInputs[0],
                gradeClaimProofInputs[1],
                weightedRequiredCredentialGradeThreshold,
                _hash(signal),
                externalNullifierHash
            ]
        );

        testGroups[requiredCredentialTestId].nullifierHashes[gradeClaimProofInputs[1]] = true;

        _solveTest(testId, testProofInputs, testProof, testPassed);
    }

    /// @dev Verifies the test proof and updates the on-chain credential accordingly
    function _solveTest(
        uint256 testId,
        uint256[4] calldata testProofInputs,
        uint256[8] calldata proof,
        bool testPassed
    ) internal onlyExistingTests(testId) {
        if (tests[testId].minimumGrade == 255) {
            revert TestWasInvalidated();
        }

        if (tests[testId].timeLimit != 0 && block.timestamp > tests[testId].timeLimit) {
            revert TimeLimitReached();
        }

        if (testPassed || tests[testId].minimumGrade == 0) {  // test always gets passed when minimumGrade = 0
            uint[10] memory proofInput = [
                testGroups[testId].credentialsTreeIndex,
                testProofInputs[0],
                testGroups[testId].credentialsTreeRoot,
                testProofInputs[1],
                testGroups[testId].gradeTreeIndex,
                testProofInputs[2],
                testGroups[testId].gradeTreeRoot,
                testProofInputs[3],
                tests[testId].testRoot,
                tests[testId].testParameters
            ];

            if (!testVerifier.verifyProof(proof, proofInput)) {
                revert SolutionIsNotValid();
            }

            // Member added to credentials tree
            emit MemberAdded(
                3 * testId - 1,                           // groupId
                testGroups[testId].credentialsTreeIndex,  // index
                testProofInputs[0],                       // identityCommitment
                testProofInputs[1]                        // credentialsTreeRoot
            );

            emit CredentialsGained(
                testId,              // testId
                testProofInputs[0],  // identityCommitment
                testProofInputs[2]   // gradeCommitment
            );
            
            testGroups[testId].credentialsTreeIndex += 1;
            testGroups[testId].credentialsTreeRoot = testProofInputs[1];
        } else {
            uint[10] memory proofInput = [
                testGroups[testId].noCredentialsTreeIndex,
                testProofInputs[0],
                testGroups[testId].noCredentialsTreeRoot,
                testProofInputs[1],
                testGroups[testId].gradeTreeIndex,
                testProofInputs[2],
                testGroups[testId].gradeTreeRoot,
                testProofInputs[3],
                tests[testId].testRoot,
                tests[testId].nonPassingTestParameters
            ];

            if (!testVerifier.verifyProof(proof, proofInput)) {
                revert SolutionIsNotValid();
            }

            // Member added to no credentials tree
            emit MemberAdded(
                3 * testId,                                 // groupId
                testGroups[testId].noCredentialsTreeIndex,  // index
                testProofInputs[0],                         // identityCommitment
                testProofInputs[1]                          // noCredentialsTreeRoot
            );

            emit CredentialsNotGained(
                testId,              // testId
                testProofInputs[0],  // identityCommitment
                testProofInputs[2]   // gradeCommitment
            );

            testGroups[testId].noCredentialsTreeIndex += 1;
            testGroups[testId].noCredentialsTreeRoot = testProofInputs[1];
        }
        
        // Member always gets added to grade tree
        emit MemberAdded(
            3 * testId - 2,                     // groupId
            testGroups[testId].gradeTreeIndex,  // index
            testProofInputs[2],                 // gradeCommitment
            testProofInputs[3]                  // gradeTreeRoot
        );

        testGroups[testId].gradeTreeIndex += 1;
        testGroups[testId].gradeTreeRoot = testProofInputs[3];
        testGroups[testId].merkleRootCreationDates[testProofInputs[1]] = block.timestamp;
        testGroups[testId].merkleRootCreationDates[testProofInputs[3]] = block.timestamp;
    }

    /// @dev See {ICredentials-rateIssuer}
    function rateIssuer(
        uint256 testId,
        uint128 rating,
        string calldata comment,
        uint256[8] calldata proof,
        uint256[2] calldata proofInputs
    ) external override onlyExistingTests(testId) {
        if(rating > 100) {
            revert InvalidRating();
        }

        uint256 signal = uint(keccak256(abi.encode(rating, comment)));
        // formatBytes32String("bq-rate")
        uint256 externalNullifier = 0x62712d7261746500000000000000000000000000000000000000000000000000;

        _verifyMerkleRootValidity(testId, proofInputs[0], testGroups[testId].credentialsTreeRoot);

        if (testGroups[testId].nullifierHashes[proofInputs[1]]) {
            revert UsingSameNullifierTwice();
        }

        semaphoreVerifier.verifyProof(proofInputs[0], proofInputs[1], signal, externalNullifier, proof, N_LEVELS);

        testGroups[testId].nullifierHashes[proofInputs[1]] = true;
        testRatings[testId].totalRating += rating;
        testRatings[testId].nRatings++;

        emit NewRating(testId, tests[testId].admin, rating, comment);
    }

    /// @dev Verifies that the given Merkle root for proof of inclusions is not expired.
    /// This check is made so that proofs can use an old Merkle root, see:
    /// https://github.com/semaphore-protocol/semaphore/issues/98
    function _verifyMerkleRootValidity(
        uint256 testId,
        uint256 usedMerkleRoot,
        uint256 currentMerkleRoot
    ) internal view {
        if (usedMerkleRoot != currentMerkleRoot) {
            uint256 merkleRootCreationDate = testGroups[testId].merkleRootCreationDates[usedMerkleRoot];

            if (merkleRootCreationDate == 0) {
                revert MerkleTreeRootIsNotPartOfTheGroup();
            }

            if (block.timestamp > merkleRootCreationDate + MERKLE_TREE_DURATION) {
                revert MerkleTreeRootIsExpired();
            }
        }
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
    function getMerkleTreeRoot(uint256 groupId) external view override onlyExistingTests((groupId + 2) / 3) returns (uint256) {
        uint256 testId = (groupId + 2) / 3;
        if (groupId % 3 == 1) {
            return testGroups[testId].gradeTreeRoot;
        } else if (groupId % 3 == 2) {
            return testGroups[testId].credentialsTreeRoot;
        } else {  // groupId % 3 == 0
            return testGroups[testId].noCredentialsTreeRoot;
        }
    }

    /// @dev See {ISemaphoreGroups-getMerkleTreeDepth}
    function getMerkleTreeDepth(uint256 /* testId */) external pure override returns (uint256) {
        // Independent of the testId
        return N_LEVELS;
    }
    
    /// @dev See {ISemaphoreGroups-getNumberOfMerkleTreeLeaves}
    function getNumberOfMerkleTreeLeaves(uint256 groupId) external view override onlyExistingTests((groupId + 2) / 3) returns (uint256) {
        uint256 testId = (groupId + 2) / 3;
        if (groupId % 3 == 1) {
            return uint256(testGroups[testId].gradeTreeIndex);
        } else if (groupId % 3 == 2) {
            return uint256(testGroups[testId].credentialsTreeIndex);
        } else {  // groupId % 3 == 0
            return uint256(testGroups[testId].noCredentialsTreeIndex);
        }
    }

    /// @dev Returns whether the test exists
    /// @param testId: id of the test
    /// @return Test existence
    function _testExists(uint256 testId) internal view virtual returns (bool) {
        return testId <= nTests && testId != 0;
    }

    /// @dev Creates a keccak256 hash of a message compatible with the SNARK scalar modulus.
    /// @param message: Message to be hashed.
    /// @return Message digest.
    function _hash(uint256 message) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(message))) >> 8;
    }
}
