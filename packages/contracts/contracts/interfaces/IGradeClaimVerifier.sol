//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../libs/PairingLib.sol";

/// @title GradeClaimVerifier contract interface.
interface IGradeClaimVerifier {
    error InvalidProof();

    struct VerificationKey {
        PairingLib.G1Point alfa1;
        PairingLib.G2Point beta2;
        PairingLib.G2Point gamma2;
        PairingLib.G2Point delta2;
        PairingLib.G1Point[] IC;
    }

    struct Proof {
        PairingLib.G1Point A;
        PairingLib.G2Point B;
        PairingLib.G1Point C;
    }

    /// @dev Verifies whether a Semaphore proof is valid.
    /// @param gradeTreeRoot: Root of the grade tree.
    /// @param nullifierHash: Nullifier hash.
    /// @param signal: Semaphore signal.
    /// @param gradeThreshold: Proved lower bound for the user's grade. 
    /// @param externalNullifier: External nullifier.
    /// @param proof: Zero-knowledge proof.
    /// @param merkleTreeDepth: Depth of the tree.
    function verifyProof(
        uint256 gradeTreeRoot,
        uint256 nullifierHash,
        uint256 gradeThreshold,
        uint256 signal,
        uint256 externalNullifier,
        uint256[8] calldata proof,
        uint256 merkleTreeDepth
    ) external view;
}