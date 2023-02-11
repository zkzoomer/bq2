pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/comparators.circom";
include "./verifiers/verify_grade.circom";

template GradeClaim(nLevels) {
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input gradeTreePathIndices[nLevels];
    signal input gradeTreeSiblings[nLevels];

    signal input weightedGrade;
    signal input weightedGradeThreshold;
    signal input signalHash;
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
    verifyGrade.currentGrade <== weightedGrade;

    component calculateNullifierHash = CalculateNullifierHash();
    calculateNullifierHash.externalNullifier <== externalNullifier;
    calculateNullifierHash.identityNullifier <== identityNullifier;

    component gradeGreaterEqThanThreshold = GreaterEqThan(13);  // Max value is 100 * 64 = 6400 < 2**13 - 1 = 8191
    gradeGreaterEqThanThreshold.in[0] <== weightedGrade;
    gradeGreaterEqThanThreshold.in[1] <== weightedGradeThreshold;

    gradeGreaterEqThanThreshold.out === 1;

    // Dummy square to prevent tampering signalHash.
    signal signalHashSquared;
    signalHashSquared <== signalHash * signalHash;

    gradeTreeRoot <== verifyGrade.root;
    nullifierHash <== calculateNullifierHash.out;
}

component main {public [weightedGradeThreshold, signalHash, externalNullifier]} = GradeClaim(16);
