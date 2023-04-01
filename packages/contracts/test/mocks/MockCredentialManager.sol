// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title MockCredentialManager
contract MockCredentialManager is IERC165 {
    
    function createCredential(
        uint256 /* credentialId */,
        uint256 /* treeDepth */,
        bytes calldata /* credentialData */
    ) external pure {
        
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 /* interfaceId */) public pure override returns (bool) {
        return true;
    }
}