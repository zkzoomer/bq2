pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/comparators.circom";
include "./verifiers/verify_grade.circom";

template GradeClaim(nLevels) {
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input treePathIndices[nLevels];
    signal input treeSiblings[nLevels];

    signal input grade;
    signal input gradeThreshold;
    signal input externalNullifier;

    signal output root;
    signal output nullifierHash;

    component verifyGrade = VerifyGrade(nLevels);
    verifyGrade.identityNullifier <== identityNullifier;
    verifyGrade.identityTrapdoor <== identityTrapdoor;
    for (var i = 0; i < nLevels; i++) {
        verifyGrade.treePathIndices[i] <== treePathIndices[i];
        verifyGrade.treeSiblings[i] <== treeSiblings[i];
    }
    verifyGrade.grade <== grade;
    verifyGrade.externalNullifier <== externalNullifier;

    component gradeGreaterEqThanThreshold = GreaterEqThan(13);  // Max value is 100 * 64 = 6400 < 2**13 - 1 = 8191
    gradeGreaterEqThanThreshold.in[0] <== grade;
    gradeGreaterEqThanThreshold.in[1] <== gradeThreshold;

    gradeGreaterEqThanThreshold.out === 1;

    root <== verifyGrade.root;
    nullifierHash <== verifyGrade.nullifierHash;
}

component main {public [gradeThreshold, externalNullifier]} = GradeClaim(20);
