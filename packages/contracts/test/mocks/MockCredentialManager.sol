// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title MockCredentialManager
contract MockCredentialManager is IERC165 {

    struct CredentialState {
        uint80 credentialsTreeIndex;
        uint80 noCredentialsTreeIndex;
        uint80 gradeTreeIndex;
        uint256 gradeTreeRoot;
        uint256 credentialsTreeRoot;
        uint256 noCredentialsTreeRoot;
    }
    
    /// @dev See {ICredentialManager-createCredential}.
    /// Mock implementation
    function createCredential(
        uint256 /* credentialId */,
        uint256 /* treeDepth */,
        bytes calldata /* credentialData */
    ) external pure returns (CredentialState memory) {
        return CredentialState(
            0,
            0,
            0,
            0,
            0,
            0
        );
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 /* interfaceId */) public pure override returns (bool) {
        return true;
    }
}