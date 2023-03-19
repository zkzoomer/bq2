// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ICredentialHandler {
    /// @dev Invalidates a credential, making it no longer solvable.
    /// @param credentialId: Id of the credential to invalidate.
    function invalidateCredential(
        uint256 credentialId
    ) external;

    /// @dev Returns the data that defines the credential as per the credential manager.
    /// @param credentialId: Id of the credential.
    /// @return bytes, credential data.
    function getCredentialData(
        uint256 credentialId
    ) external view returns (bytes memory);

    /// @dev Returns the data that defines the credential as per the credential manager.
    /// @param credentialId: Id of the credential.
    /// @return bytes, credential data.
    function getCredentialAdmin(
        uint256 credentialId
    ) external view returns (address);

    /// @dev Returns whether the credential exists, that is, if it has been created.
    /// @param credentialId: Id of the credential.
    /// @return bool, whether the credential exists.
    function credentialExists(
        uint256 credentialId
    ) external view returns (bool);

    /// @dev Returns whether the credential is valid, that is, if it has been created and not invalidated.
    /// @param credentialId: Id of the credential.
    /// @return bool, whether the credential is valid.
    function credentialIsValid(
        uint256 credentialId
    ) external view returns (bool);
}