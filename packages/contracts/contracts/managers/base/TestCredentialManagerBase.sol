// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../interfaces/ICredentialsRegistry.sol";
import "../interfaces/ITestVerifier.sol";
import "../interfaces/ITestCredentialManager.sol";
import { TestCredential, TestCredentialHashes } from "../libs/Structs.sol";

abstract contract TestCredentialManagerBase is ITestCredentialManager, Context {
    uint256 constant MAX_GRADE = 100;

    /// @dev Gets a credential id and returns the credential parameters
    mapping(uint256 => TestCredential) public testCredentials;
    /// @dev Gets a credential id and returns the test hashes
    mapping(uint256 => TestCredentialHashes) public testCredentialsHashes;

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

    /// @dev Enforces that the credential admin is the transaction sender.
    /// @param credentialId: Id of the credential.
    modifier onlyCredentialAdmin(uint256 credentialId) {
        if (testCredentials[credentialId].admin != tx.origin) {
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
        if (testCredentials[credentialId].minimumGrade == 255) {
            revert CredentialWasInvalidated();
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
        testCredentials[credentialId].minimumGrade = 255;

        emit CredentialInvalidated(credentialId);
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(ICredentialManager).interfaceId;
    }

    /// @dev Validates the TestCredential struct
    function _validateTestCredential(
        uint256 credentialId,
        TestCredential memory testCredential
    ) internal view {
        if (testCredential.testHeight < 4 || testCredential.testHeight > 6) {
            revert TestDepthIsNotSupported();
        }

        // Ensure the required credential exists, if it was specified
        if (testCredential.requiredCredential != 0) {
            if (testCredential.requiredCredential == credentialId) {
                revert CannotRequireSameCredential();
            }

            if (!credentialsRegistry.credentialExists(testCredential.requiredCredential)) {
                revert RequiredCredentialDoesNotExist();
            }
        }

        // Ensure that the required credential was specified if the grade threshold is given
        if (testCredential.requiredCredentialGradeThreshold > 0 && testCredential.requiredCredential == 0) {
            revert GradeRestrictedTestsMustSpecifyRequiredCredential();
        }

        if (testCredential.timeLimit < block.timestamp && testCredential.timeLimit != 0) {
            revert TimeLimitIsInThePast();
        }

        if (testCredential.nQuestions > 2 ** testCredential.testHeight || testCredential.nQuestions == 0 ) {
            revert InvalidNumberOfQuestions();
        }

        if (testCredential.minimumGrade > MAX_GRADE) {
            revert InvalidMinimumGrade();
        }

        if (testCredential.multipleChoiceWeight > 100) {
            revert InvalidMultipleChoiceWeight();
        }
    }
}
