// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../interfaces/ICredentialsRegistry.sol";
import "../interfaces/ITestVerifier.sol";
import "../interfaces/ITestCredentialManager.sol";
import { CredentialTest } from "../libs/Structs.sol";

abstract contract TestCredentialManagerBase is ITestCredentialManager, Context {
    uint256 constant MAX_QUESTIONS = 2 ** 6;
    uint256 constant MAX_GRADE = 100;

    /// @dev Gets a credential id and returns the credential test parameters
    mapping(uint256 => CredentialTest) public credentialTests;

    /// @dev Gets a credential id and returns the list of open answer hashes for the credential test
    mapping(uint256 => uint256[]) public credentialTestOpenAnswersHashes;

    /// @dev CredentialsRegistry smart contract
    ICredentialsRegistry public credentialsRegistry;
    
    /// @dev TestVerifier smart contract
    ITestVerifier public testVerifier;

    /// @dev Enforces that the Credentials Registry is the transaction sender.
    /// @param credentialId: Id of the credential.
    modifier onlyCredentialsRegistry(uint256 credentialId) {
        if (address(credentialsRegistry) != _msgSender()) {
            revert CallerIsNotTheCredentialsRegistry();
        }
        _;
    }

    /// @dev Checks if the credential admin is the transaction sender.
    /// @param credentialId: Id of the credential.
    modifier onlyCredentialAdmin(uint256 credentialId) {
        if (credentialTests[credentialId].admin != tx.origin) {
            revert CallerIsNotTheCredentialAdmin();
        }
        _;
    }

    /// @dev Enforces that this test credential exists, that is, if it is managed by the test credential manager.
    /// @param credentialId: Id of the credential.
    modifier onlyExistingTestCredentials(uint256 credentialId) {
        if (credentialsRegistry.getCredentialManager(credentialId) != address(this)) {
            revert TestCredentialDoesNotExist();
        }
        credentialsRegistry.credentialExists(credentialId);
        _;
    }

    /// @dev Enforces that the test credential was not invalidated.
    /// Note that test credentials that are not defined yet are also not invalidated.
    /// @param credentialId: Id of the credential.
    modifier onlyValidTestCredentials(uint256 credentialId) {
        if (credentialTests[credentialId].minimumGrade == 255) {
            revert TestCredentialWasInvalidated();
        }
        _;
    }

    /// @dev See {ICredentialHandler-invalidateCredential}
    function invalidateCredential(
        uint256 credentialId
    ) 
        external override 
        onlyExistingTestCredentials(credentialId) 
        onlyValidTestCredentials(credentialId) 
        onlyCredentialsRegistry(credentialId) 
        onlyCredentialAdmin(credentialId) 
    {
        credentialTests[credentialId].minimumGrade = 255;

        emit CredentialInvalidated(credentialId);
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(ICredentialManager).interfaceId;
    }

    /// @dev See {ITestCredentialManager-getOpenAnswersHashes}
    function getOpenAnswersHashes(
        uint256 credentialId
    ) external view override onlyExistingTestCredentials(credentialId) returns (uint256[] memory) {
        return credentialTestOpenAnswersHashes[credentialId];
    }

    /// @dev Validates the TestInitializingParameters struct
    function _validateInitParams(
        uint256 credentialId,
        TestInitializingParameters memory initParams
    ) internal view {
        // Ensure the required credential exists, if it was specified
        if (initParams.requiredCredential != 0) {
            if (initParams.requiredCredential == credentialId) {
                revert CannotRequireSameCredential();
            }
            credentialsRegistry.credentialExists(initParams.requiredCredential);
        }

        // Ensure that the required credential was specified if the grade threshold is given
        if (initParams.requiredCredentialGradeThreshold > 0 && initParams.requiredCredential == 0) {
            revert GradeRestrictedTestsMustSpecifyRequiredCredential();
        }

        if (initParams.timeLimit < block.timestamp && initParams.timeLimit != 0) {
            revert TimeLimitIsInThePast();
        }

        if (initParams.nQuestions > MAX_QUESTIONS || initParams.nQuestions == 0 ) {
            revert InvalidNumberOfQuestions();
        }

        if (initParams.minimumGrade > MAX_GRADE) {
            revert InvalidMinimumGrade();
        }

        if (initParams.multipleChoiceWeight > 100) {
            revert InvalidMultipleChoiceWeight();
        }
    }
}
