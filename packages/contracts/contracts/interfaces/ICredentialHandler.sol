// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ICredentialHandler {
    // TODO
    function invalidateCredential(
        uint256 credentialId
    ) external;

    /// TODO
    function getCredentialData(
        uint256 credentialId
    ) external view returns (bytes memory);

    /// TODO
    function getCredentialAdmin(
        uint256 credentialId
    ) external view returns (address);

    function credentialExists(
        uint256 credentialId
    ) external view returns (bool);

    /// TODO 
    function credentialIsValid(
        uint256 credentialId
    ) external view returns (bool);
}