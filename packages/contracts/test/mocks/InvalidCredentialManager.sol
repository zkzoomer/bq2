// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title InvalidCredentialManager
/// @dev Mock contract that does NOT support the ICredentialManager interface.
contract InvalidCredentialManager is IERC165 {
    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 /* interfaceId */) public pure override returns (bool) {
        return false;
    }
}
