pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./lib/merkle_inclusion.circom";
include "./lib/path_indices_to_member_index.circom";
include "./verifiers/verify_mixed_test.circom";
include "./verifiers/verify_grade.circom";

template UpdateGrade(k, nLevels) {
    var maxQuestions = 2**k;

    // Test parameters
    signal input minimumGrade;
    signal input multipleChoiceWeight;
    signal input nQuestions;

    // User's new multiple choice answers tree
    signal input multipleChoiceAnswers[maxQuestions];
    // Correct multiple choice answers tree root, given by the smart contract
    signal input solutionHash;

    // User's new answers tree
    signal input openAnswers[maxQuestions];
    // Correct answers hashes tree
    signal input openAnswersHashes[maxQuestions];
    // Correct answers hashes tree root, given by the smart contract
    signal input openAnswersHashesRoot;

    signal input identityNullifier;
    signal input identityTrapdoor;

    signal input currentGrade;
    signal input gradeTreePathIndices[nLevels];
    signal input gradeTreeSiblings[nLevels];
    
    signal output gradeCommitmentIndex;
    signal output oldGradeCommitment;
    signal output newGradeCommitment;
    signal output oldGradeTreeRoot;
    signal output newGradeTreeRoot;
    signal output testRoot;
    signal output testParameters;

    component verifyCurrentGrade = VerifyGrade(nLevels);
    verifyCurrentGrade.identityNullifier <== identityNullifier;
    verifyCurrentGrade.identityTrapdoor <== identityTrapdoor;
    verifyCurrentGrade.currentGrade <== currentGrade;
    for (var i = 0; i < nLevels; i++) {
        verifyCurrentGrade.gradeTreePathIndices[i] <== gradeTreePathIndices[i];
        verifyCurrentGrade.gradeTreeSiblings[i] <== gradeTreeSiblings[i];
    }
    
    // User must obtain a strictly higher grade than the current one 
    // The non equality check is made in the smart contract with the gradeCommitment
    component verifyMixedTest = VerifyMixedTest(k);
    verifyMixedTest.minimumGrade <== currentGrade;  
    verifyMixedTest.multipleChoiceWeight <== multipleChoiceWeight;
    verifyMixedTest.nQuestions <== nQuestions;
    verifyMixedTest.solutionHash <== solutionHash;
    for (var i = 0; i < maxQuestions; i++) {
        verifyMixedTest.multipleChoiceAnswers[i] <== multipleChoiceAnswers[i];
        verifyMixedTest.openAnswersHashes[i] <== openAnswersHashes[i];
        verifyMixedTest.openAnswers[i] <== openAnswers[i];
    }
    verifyMixedTest.openAnswersHashesRoot <== openAnswersHashesRoot;
    verifyMixedTest.identityNullifier <== identityNullifier;
    verifyMixedTest.identityTrapdoor <== identityTrapdoor;

    component calculateTestParameters = Poseidon(3);
    calculateTestParameters.inputs[0] <== minimumGrade;
    calculateTestParameters.inputs[1] <== multipleChoiceWeight;
    calculateTestParameters.inputs[2] <== nQuestions;

    component calculateNewRoot = MerkleTreeInclusionProof(nLevels);
    calculateNewRoot.leaf <== verifyMixedTest.gradeCommitment;
    for (var i = 0; i < nLevels; i++) {
        calculateNewRoot.siblings[i] <== gradeTreeSiblings[i];
        calculateNewRoot.pathIndices[i] <== gradeTreePathIndices[i];
    }

    component calculateGradeCommitmentIndex = PathIndicesToMemberIndex(nLevels);
    for (var i = 0; i < nLevels; i++) {
        calculateGradeCommitmentIndex.pathIndices[i] <== gradeTreePathIndices[i];
    }
    
    gradeCommitmentIndex <== calculateGradeCommitmentIndex.out;
    oldGradeCommitment <== verifyCurrentGrade.gradeCommitment;
    newGradeCommitment <== verifyMixedTest.gradeCommitment;
    oldGradeTreeRoot <== verifyCurrentGrade.root;
    newGradeTreeRoot <== calculateNewRoot.root;

    testRoot <== verifyMixedTest.testRoot;
    testParameters <== calculateTestParameters.out;
}

component main = UpdateGrade(6, 16);
