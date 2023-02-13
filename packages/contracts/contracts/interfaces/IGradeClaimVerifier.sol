//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../lib/Pairing.sol";

/// @title Test Verifier interface.
/// @dev Interface of Test Verifier contract.
interface IGradeClaimVerifier {
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    function verifyProof(
        uint256[8] calldata proof,
        uint256[5] memory input
    ) external view returns (bool);
}
