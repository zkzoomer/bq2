// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "../../interfaces/ICredentialsRegistry.sol";
import "../interfaces/ILegacyCredentialManager.sol";

abstract contract LegacyCredentialManagerBase is ILegacyCredentialManager, Context {
    uint256 constant MAX_GRADE = 100;

    /// @dev Gets a credential id and returns the credential parameters
    mapping(uint256 => address) public legacyCredentialAdmins;
    /// @dev Gets a credential id and returns is valid status
    mapping(uint256 => bool) public invalidatedLegacyCredentials;

    /// @dev CredentialsRegistry smart contract
    ICredentialsRegistry public credentialsRegistry;

    /// @dev Enforces that the Credentials Registry is the transaction sender.
    /// @param credentialId: Id of the credential.
    modifier onlyCredentialsRegistry(uint256 credentialId) {
        if (address(credentialsRegistry) != _msgSender()) {
            revert CallerIsNotTheCredentialsRegistry();
        }
        _;
    }

    /// @dev Enforces that the legacy credential admin is the transaction sender.
    /// @param credentialId: Id of the credential.
    modifier onlyCredentialAdmin(uint256 credentialId) {
        if (legacyCredentialAdmins[credentialId] != tx.origin) {
            revert CallerIsNotTheCredentialAdmin();
        }
        _;
    }

    /// @dev Enforces that this legacy credential exists, that is, if it is managed by the legacy credential manager.
    /// @param credentialId: Id of the credential.
    modifier onlyExistingLegacyCredentials(uint256 credentialId) {
        if (credentialsRegistry.getCredentialManager(credentialId) != address(this)) {
            revert LegacyCredentialDoesNotExist();
        }
        credentialsRegistry.credentialExists(credentialId);
        _;
    }

    /// @dev Enforces that the legacy credential was not invalidated.
    /// Note that legacy credentials that are not defined yet are also not invalidated.
    /// @param credentialId: Id of the credential.
    modifier onlyValidLegacyCredentials(uint256 credentialId) {
        if (invalidatedLegacyCredentials[credentialId]) {
            revert CredentialWasInvalidated();
        }
        _;
    }

    /// @dev See {ICredentialHandler-invalidateCredential}
    function invalidateCredential(
        uint256 credentialId
    ) 
        external override 
        onlyExistingLegacyCredentials(credentialId) 
        onlyValidLegacyCredentials(credentialId) 
        onlyCredentialsRegistry(credentialId) 
        onlyCredentialAdmin(credentialId) 
    {
        invalidatedLegacyCredentials[credentialId] = true;

        emit CredentialInvalidated(credentialId);
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(ICredentialManager).interfaceId;
    }
}
