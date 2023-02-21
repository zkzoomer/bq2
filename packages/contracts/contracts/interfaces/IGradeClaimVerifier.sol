//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../lib/PairingLib.sol";

/// @title Test Verifier interface.
/// @dev Interface of Test Verifier contract.
interface IGradeClaimVerifier {
    struct VerifyingKey {
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

    /// @dev Verifies a grade claim proof
    /// @param proof: SNARk proof
    /// @param input: public inputs for the proof, these being:
    ///     - gradeTreeRoot
    ///     - nullifierHash
    ///     - weightedGradeThreshold
    ///     - signalHash
    ///     - externalNullifier
    /// @return true if the proof is valid, false otherwise
    function verifyProof(
        uint256[8] calldata proof,
        uint256[5] memory input
    ) external view returns (bool);
}
