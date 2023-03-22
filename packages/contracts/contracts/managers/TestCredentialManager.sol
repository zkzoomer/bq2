// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./base/TestCredentialManagerBase.sol";
import { PoseidonT3, PoseidonT4 } from "../libs/Poseidon.sol";
import { 
    TestInitializingParameters, 
    TestFullProof, 
    CredentialClaimFullProof,
    GradeClaimFullProof,
    CredentialRestrictedTestFullProof, 
    GradeRestrictedTestFullProof 
} from "./libs/Structs.sol";

/// @title TestCredentialManager
/// @dev Defines the behavior of the Test credential, where users gain their credentials by providing proofs of knowledge
/// of the solution to mixed tests (multiple choice + open answer components).
contract TestCredentialManager is TestCredentialManagerBase {
    /// @dev Initializes the TestBase smart contract
    /// @param credentialsRegistryAddress: Contract address of the CredentialsRegistry smart contract that
    /// governs this CredentialManager.
    /// @param testVerifierAddress: Contract address for the test circuit proof verifier.
    constructor(
        address credentialsRegistryAddress,
        address testVerifierAddress
    ) {
        credentialsRegistry = ICredentialsRegistry(credentialsRegistryAddress);
        testVerifier = ITestVerifier(testVerifierAddress);
    }

    /// @dev See {ICredentialHandler-createCredential}.
    function createCredential(
        uint256 credentialId,
        bytes calldata credentialData
    ) external virtual override onlyCredentialsRegistry(credentialId) {
        TestInitializingParameters memory initParams = abi.decode(credentialData, (TestInitializingParameters));

        _validateInitParams(credentialId, initParams);
        
        uint256 testParameters = PoseidonT4.poseidon(
            [
                uint256(initParams.minimumGrade) /* * uint256(initParams.nQuestions) */, 
                uint256(initParams.multipleChoiceWeight), 
                uint256(initParams.nQuestions)
            ]
        );
        uint256 nonPassingTestParameters;

        if (initParams.minimumGrade != 0) {
            nonPassingTestParameters = PoseidonT4.poseidon(
                [uint256(0), uint256(initParams.multipleChoiceWeight), uint256(initParams.nQuestions)]
            );
        } else {
            nonPassingTestParameters = testParameters;
        }

        credentialTests[credentialId] = CredentialTest(
            initParams.minimumGrade,
            initParams.multipleChoiceWeight,
            initParams.nQuestions,
            initParams.timeLimit,
            initParams.admin,
            initParams.requiredCredential,
            initParams.requiredCredentialGradeThreshold,
            initParams.multipleChoiceRoot,
            initParams.openAnswersHashesRoot,
            PoseidonT3.poseidon([initParams.multipleChoiceRoot, initParams.openAnswersHashesRoot]),
            testParameters,
            nonPassingTestParameters
        );
    }

    /// @dev See {ICredentialHandler-updateCredential}.
    function updateCredential(
        uint256 credentialId,
        CredentialState calldata credentialState,
        bytes calldata credentialUpdate
    ) 
        external virtual override 
        onlyCredentialsRegistry(credentialId) 
        onlyValidTestCredentials(credentialId) 
        returns (CredentialState memory newCredentialState) 
    {
        CredentialTest memory credentialTest = credentialTests[credentialId];

        if (credentialTest.requiredCredentialGradeThreshold > 0) {  // Grade restricted 
            GradeRestrictedTestFullProof memory gradeRestrictedTestFullProof = abi.decode(
                credentialUpdate, 
                (GradeRestrictedTestFullProof)
            );

            uint256 signal = uint(keccak256(abi.encode(
                gradeRestrictedTestFullProof.testFullProof.identityCommitment, 
                gradeRestrictedTestFullProof.testFullProof.newIdentityTreeRoot, 
                gradeRestrictedTestFullProof.testFullProof.gradeCommitment, 
                gradeRestrictedTestFullProof.testFullProof.newGradeTreeRoot
            )));

            _verifyGradeRestriction(
                credentialId, 
                signal,
                gradeRestrictedTestFullProof.gradeClaimFullProof
            );

            newCredentialState = _solveTest(
                credentialId, 
                credentialState,
                gradeRestrictedTestFullProof.testFullProof
            );
        } else if (credentialTest.requiredCredential > 0) {  // Credential restricted 
            CredentialRestrictedTestFullProof memory credentialRestrictedTestFullProof = abi.decode(
                credentialUpdate, 
                (CredentialRestrictedTestFullProof)
            );

            uint256 signal = uint(keccak256(abi.encode(
                credentialRestrictedTestFullProof.testFullProof.identityCommitment, 
                credentialRestrictedTestFullProof.testFullProof.newIdentityTreeRoot, 
                credentialRestrictedTestFullProof.testFullProof.gradeCommitment, 
                credentialRestrictedTestFullProof.testFullProof.newGradeTreeRoot
            )));

            _verifyCredentialRestriction(
                credentialId, 
                signal,
                credentialRestrictedTestFullProof.credentialClaimFullProof
            );

            newCredentialState = _solveTest(
                credentialId, 
                credentialState, 
                credentialRestrictedTestFullProof.testFullProof
            );
        } else {  // No restriction
            TestFullProof memory testFullProof = abi.decode(
                credentialUpdate, 
                (TestFullProof)
            );

            newCredentialState = _solveTest(
                credentialId, 
                credentialState, 
                testFullProof
            );
        }
    }
    
    /// @dev See {ITestCredentialManager-verifyTestCredentialAnswers}.
    function verifyTestCredentialAnswers(
        uint256 credentialId,
        uint256[] memory answerHashes
    ) external override onlyExistingTestCredentials(credentialId) onlyCredentialAdmin(credentialId) {
        if (credentialTests[credentialId].multipleChoiceWeight == 100 || credentialTestOpenAnswersHashes[credentialId].length != 0) {
            // A multiple choice test already has their test answers "verified", as these do not exist
            revert CredentialTestAnswersAlreadyVerified();
        }

        if (credentialTests[credentialId].nQuestions != answerHashes.length) {
            revert InvalidCredentialTestAnswersLength();
        }

        credentialTestOpenAnswersHashes[credentialId] = answerHashes;
    }

    /// @dev See {ICredentialHandler-getCredentialData}.
    function getCredentialData(
        uint256 credentialId
    ) external view virtual override onlyExistingTestCredentials(credentialId) returns (bytes memory) {
        return abi.encode(credentialTests[credentialId]);
    }

    /// @dev See {ICredentialHandler-getCredentialAdmin}.
    function getCredentialAdmin(
        uint256 credentialId
    ) external view virtual override onlyExistingTestCredentials(credentialId) returns (address) {
        return credentialTests[credentialId].admin;
    }

    /// @dev See {ICredentialHandler-credentialIsValid}.
    function credentialIsValid(
        uint256 credentialId
    ) external view virtual override onlyExistingTestCredentials(credentialId) returns (bool) {
        return credentialTests[credentialId].minimumGrade != 255;
    }

    /// @dev See {ICredentialHandler-credentialExists}.
    function credentialExists(
        uint256 credentialId
    ) external view virtual override onlyExistingTestCredentials(credentialId) returns (bool) {
        return true;
    }

    function _solveTest(
        uint256 credentialId,
        CredentialState memory credentialState,
        TestFullProof memory testFullProof
    ) internal returns (CredentialState memory) {
        if (credentialTests[credentialId].timeLimit != 0 && block.timestamp > credentialTests[credentialId].timeLimit) {
            revert TimeLimitReached();
        }

        if (testFullProof.testPassed || credentialTests[credentialId].minimumGrade == 0) {
            
            uint[10] memory proofInput = [
                credentialState.credentialsTreeIndex,
                testFullProof.identityCommitment,
                credentialState.credentialsTreeRoot,
                testFullProof.newIdentityTreeRoot,
                credentialState.gradeTreeIndex,
                testFullProof.gradeCommitment,
                credentialState.gradeTreeRoot,
                testFullProof.newGradeTreeRoot,
                credentialTests[credentialId].testRoot,
                credentialTests[credentialId].testParameters
            ];

            testVerifier.verifyProof(testFullProof.testProof, proofInput);

            credentialState.credentialsTreeIndex++;
            credentialState.credentialsTreeRoot = testFullProof.newIdentityTreeRoot;

            emit CredentialsMemberAdded(
                credentialId,
                credentialState.credentialsTreeIndex,
                testFullProof.identityCommitment,
                testFullProof.newIdentityTreeRoot
            );
       
        } else {

            uint[10] memory proofInput = [
                credentialState.noCredentialsTreeIndex,
                testFullProof.identityCommitment,
                credentialState.noCredentialsTreeRoot,
                testFullProof.newIdentityTreeRoot,
                credentialState.gradeTreeIndex,
                testFullProof.gradeCommitment,
                credentialState.gradeTreeRoot,
                testFullProof.newGradeTreeRoot,
                credentialTests[credentialId].testRoot,
                credentialTests[credentialId].nonPassingTestParameters
            ];

            testVerifier.verifyProof(testFullProof.testProof, proofInput);

            credentialState.noCredentialsTreeIndex++;
            credentialState.noCredentialsTreeRoot = testFullProof.newIdentityTreeRoot;

            emit NoCredentialsMemberAdded(
                credentialId,
                credentialState.noCredentialsTreeIndex,
                testFullProof.identityCommitment,
                testFullProof.newIdentityTreeRoot
            );
        }

        // User is always added to the grade tree
        credentialState.gradeTreeIndex++;
        credentialState.gradeTreeRoot = testFullProof.newGradeTreeRoot;

        emit GradeMemberAdded(
            credentialId,
            credentialState.gradeTreeIndex,
            testFullProof.gradeCommitment,
            testFullProof.newGradeTreeRoot
        );
        
        return credentialState;
    }

    function _verifyCredentialRestriction(
        uint256 credentialId,
        uint256 signal,
        CredentialClaimFullProof memory credentialClaimFullProof
    ) internal {
        uint256 requiredCredentialId = credentialTests[credentialId].requiredCredential;

        // formatBytes32String("bq-credential-restricted-test")
        uint256 externalNullifier = 0x62712d63726564656e7469616c2d726573747269637465642d74657374000000;
    
        credentialsRegistry.verifyCredentialOwnershipProof(
            requiredCredentialId,
            credentialClaimFullProof.requiredCredentialMerkleTreeRoot,
            credentialClaimFullProof.nullifierHash,
            signal,
            externalNullifier,
            credentialClaimFullProof.semaphoreProof
        );
    }

    function _verifyGradeRestriction(
        uint256 credentialId,
        uint256 signal,
        GradeClaimFullProof memory gradeClaimFullProof
    ) internal {
        uint256 requiredCredentialId = credentialTests[credentialId].requiredCredential;
        uint256 requiredCredentialGradeThreshold = credentialTests[credentialId].requiredCredentialGradeThreshold;

        // formatBytes32String("bq-grade-restricted-test")
        uint256 externalNullifier = 0x62712d67726164652d726573747269637465642d746573740000000000000000;

        credentialsRegistry.verifyGradeClaimProof(
            requiredCredentialId,
            gradeClaimFullProof.gradeClaimMerkleTreeRoot,
            gradeClaimFullProof.nullifierHash,
            requiredCredentialGradeThreshold,
            signal,
            externalNullifier,
            gradeClaimFullProof.gradeClaimProof
        );
    }
}
