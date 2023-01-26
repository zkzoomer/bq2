//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @title Verifier interface.
/// @dev Interface of Verifier contract.
interface IGradeUpdateVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[7] calldata input
    ) external view;
}