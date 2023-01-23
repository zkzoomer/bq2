pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "./lib/merkle_inclusion.circom";
include "./lib/semaphore_identity.circom";

template VerifyGrade(nLevels) {
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input treePathIndices[nLevels];
    signal input treeSiblings[nLevels];

    signal input grade;
    signal input gradeThreshold;
    signal input externalNullifier;

    signal output root;
    signal output nullifierHash;

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateNullifierHash = CalculateNullifierHash();
    calculateNullifierHash.externalNullifier <== externalNullifier;
    calculateNullifierHash.identityNullifier <== identityNullifier;

    component calculateGradeCommitment = Poseidon(2);
    calculateGradeCommitment.inputs[0] <== calculateSecret.out;
    calculateGradeCommitment.inputs[1] <== grade;

    component inclusionProof = MerkleTreeInclusionProof(nLevels);
    inclusionProof.leaf <== calculateGradeCommitment.out;

    for (var i = 0; i < nLevels; i++) {
        inclusionProof.siblings[i] <== treeSiblings[i];
        inclusionProof.pathIndices[i] <== treePathIndices[i];
    }

    component gradeGreaterEqThanThreshold = GreaterEqThan(13);  // Max value is 100 * 64 = 6400 < 2**13 - 1 = 8191
    gradeGreaterEqThanThreshold.in[0] <== grade;
    gradeGreaterEqThanThreshold.in[1] <== gradeThreshold;

    gradeGreaterEqThanThreshold.out === 1;

    root <== inclusionProof.root;
    nullifierHash <== calculateNullifierHash.out;
}

component main {public [gradeThreshold, externalNullifier]} = VerifyGrade(20);
