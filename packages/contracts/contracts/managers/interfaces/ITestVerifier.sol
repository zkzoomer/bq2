//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../libs/PairingLib.sol";

/// @title Test Verifier interface.
/// @dev Interface of Test Verifier contract.
interface ITestVerifier {
    error InvalidProof();
    
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

    /// @dev Verifies a Test proof
    /// @param proof: SNARk proof
    /// @param input: public inputs for the proof, these being:
    ///     - identityCommitmentIndex
    ///     - identityCommitment
    ///     - oldIdentityTreeRoot
    ///     - newIdentityTreeRoot
    ///     - gradeCommitmentIndex
    ///     - gradeCommitment
    ///     - oldGradeTreeRoot
    ///     - newGradeTreeRoot
    ///     - testRoot
    ///     - testParameters
    function verifyProof(
        uint256[8] calldata proof,
        uint256[10] memory input
    ) external view;
}
