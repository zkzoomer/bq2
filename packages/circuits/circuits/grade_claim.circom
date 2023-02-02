pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/comparators.circom";
include "./verifiers/verify_grade.circom";

template GradeClaim(nLevels) {
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input gradeTreePathIndices[nLevels];
    signal input gradeTreeSiblings[nLevels];

    signal input grade;
    signal input gradeThreshold;
    signal input externalNullifier;

    signal output gradeTreeRoot;
    signal output nullifierHash;

    component verifyGrade = VerifyGrade(nLevels);
    verifyGrade.identityNullifier <== identityNullifier;
    verifyGrade.identityTrapdoor <== identityTrapdoor;
    for (var i = 0; i < nLevels; i++) {
        verifyGrade.gradeTreePathIndices[i] <== gradeTreePathIndices[i];
        verifyGrade.gradeTreeSiblings[i] <== gradeTreeSiblings[i];
    }
    verifyGrade.currentGrade <== grade;

    component calculateNullifierHash = CalculateNullifierHash();
    calculateNullifierHash.externalNullifier <== externalNullifier;
    calculateNullifierHash.identityNullifier <== identityNullifier;

    component gradeGreaterEqThanThreshold = GreaterEqThan(13);  // Max value is 100 * 64 = 6400 < 2**13 - 1 = 8191
    gradeGreaterEqThanThreshold.in[0] <== grade;
    gradeGreaterEqThanThreshold.in[1] <== gradeThreshold;

    gradeGreaterEqThanThreshold.out === 1;

    gradeTreeRoot <== verifyGrade.root;
    nullifierHash <== calculateNullifierHash.out;
}

component main {public [gradeThreshold, externalNullifier]} = GradeClaim(16);
