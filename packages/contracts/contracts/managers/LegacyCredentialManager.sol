// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./base/LegacyCredentialManagerBase.sol";

contract LegacyCredentialManager is LegacyCredentialManagerBase {
    /// @dev Initializes the LegacyCredentialManager smart contract
    /// @param credentialsRegistryAddress: Contract address of the CredentialsRegistry smart contract that
    /// governs this CredentialManager.
    constructor(
        address credentialsRegistryAddress
    ) {
        credentialsRegistry = ICredentialsRegistry(credentialsRegistryAddress);
    }

    /// @dev See {ICredentialManager-createCredential}.
    function createCredential(
        uint256 credentialId,
        uint256 /* treeDepth */,
        bytes calldata credentialData
    ) 
        external virtual override 
        onlyCredentialsRegistry(credentialId) 
        returns (CredentialState memory) 
    {
        legacyCredentialAdmins[credentialId] = tx.origin;

        // Credential Admin sets the legacy credential initial state
        return abi.decode(credentialData, (CredentialState));
    }

    /// @dev See {ICredentialHandler-updateCredential}.
    function updateCredential(
        uint256 credentialId,
        CredentialState calldata /* credentialState */,
        bytes calldata credentialUpdate
    ) 
        external virtual override 
        onlyCredentialsRegistry(credentialId) 
        onlyValidLegacyCredentials(credentialId) 
        onlyCredentialAdmin(credentialId) 
        returns (CredentialState memory newCredentialState) 
    {
        // Credential Admin sets the legacy credential new state
        return abi.decode(credentialUpdate, (CredentialState));
    }

    /// @dev See {ICredentialHandler-getCredentialData}.
    function getCredentialData(
        uint256 credentialId
    ) external view virtual override onlyExistingLegacyCredentials(credentialId) returns (bytes memory) {
        return abi.encode(
            credentialsRegistry.getNumberOfMerkleTreeLeaves(3 * (credentialId - 1) + 1),
            credentialsRegistry.getNumberOfMerkleTreeLeaves(3 * (credentialId - 1) + 2),
            credentialsRegistry.getNumberOfMerkleTreeLeaves(3 * (credentialId - 1) + 3),
            credentialsRegistry.getMerkleTreeRoot(3 * (credentialId - 1) + 1),
            credentialsRegistry.getMerkleTreeRoot(3 * (credentialId - 1) + 2),
            credentialsRegistry.getMerkleTreeRoot(3 * (credentialId - 1) + 3)
        );
    }

    /// @dev See {ICredentialHandler-getCredentialAdmin}.
    function getCredentialAdmin(
        uint256 credentialId
    ) external view virtual override onlyExistingLegacyCredentials(credentialId) returns (address) {
        return legacyCredentialAdmins[credentialId];
    }

    /// @dev See {ICredentialHandler-credentialIsValid}.
    function credentialIsValid(
        uint256 credentialId
    ) external view virtual override onlyExistingLegacyCredentials(credentialId) returns (bool) {
        return !invalidatedLegacyCredentials[credentialId];
    }

    /// @dev See {ICredentialHandler-credentialExists}.
    function credentialExists(
        uint256 credentialId
    ) external view virtual override onlyExistingLegacyCredentials(credentialId) returns (bool) {
        return true;
    }
}