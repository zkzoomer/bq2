pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./lib/merkle_inclusion.circom";
include "./lib/path_indices_to_member_index.circom";
include "./verifiers/verify_mixed_test.circom";

template Test(testHeight, nLevels) {
    var maxQuestions = 2**testHeight;

    // Test parameters
    signal input minimumGrade;
    signal input multipleChoiceWeight;
    signal input nQuestions;

    // User's multiple choice answers tree
    signal input multipleChoiceAnswers[maxQuestions];
    // Correct multiple choice answers tree root, given by the smart contract
    signal input multipleChoiceRoot;

    // User's answers tree
    signal input openAnswers[maxQuestions];
    // Correct answers hashes tree
    signal input openAnswersHashes[maxQuestions];
    // Correct answers hashes tree root, given by the smart contract
    signal input openAnswersHashesRoot;

    signal input identityNullifier;
    signal input identityTrapdoor;

    signal input identityTreeEmptyLeaf;
    signal input identityTreePathIndices[nLevels];
    signal input identityTreeSiblings[nLevels];
    signal input gradeTreeEmptyLeaf;
    signal input gradeTreePathIndices[nLevels];
    signal input gradeTreeSiblings[nLevels];
    
    signal output identityCommitmentIndex;
    signal output identityCommitment;
    signal output oldIdentityTreeRoot;
    signal output newIdentityTreeRoot;

    signal output gradeCommitmentIndex;
    signal output gradeCommitment;
    signal output oldGradeTreeRoot;
    signal output newGradeTreeRoot;

    signal output testRoot;
    signal output testParameters;

    component mixedTest = VerifyMixedTest(testHeight);
    mixedTest.minimumGrade <== minimumGrade;
    mixedTest.multipleChoiceWeight <== multipleChoiceWeight;
    mixedTest.nQuestions <== nQuestions;
    mixedTest.multipleChoiceRoot <== multipleChoiceRoot;
    for (var i = 0; i < maxQuestions; i++) {
        mixedTest.multipleChoiceAnswers[i] <== multipleChoiceAnswers[i];
        mixedTest.openAnswersHashes[i] <== openAnswersHashes[i];
        mixedTest.openAnswers[i] <== openAnswers[i];
    }
    mixedTest.openAnswersHashesRoot <== openAnswersHashesRoot;
    mixedTest.identityNullifier <== identityNullifier;
    mixedTest.identityTrapdoor <== identityTrapdoor;

    component calculateTestParameters = Poseidon(3);
    calculateTestParameters.inputs[0] <== minimumGrade;
    calculateTestParameters.inputs[1] <== multipleChoiceWeight;
    calculateTestParameters.inputs[2] <== nQuestions;

    component calculateIdentityCommitmentIndex = PathIndicesToMemberIndex(nLevels);
    for (var i = 0; i < nLevels; i++) {
        calculateIdentityCommitmentIndex.pathIndices[i] <== identityTreePathIndices[i];
    }

    component calculateOldIdentityTreeRoot = MerkleTreeInclusionProof(nLevels);
    calculateOldIdentityTreeRoot.leaf <== identityTreeEmptyLeaf;
    for (var i = 0; i < nLevels; i++) {
        calculateOldIdentityTreeRoot.pathIndices[i] <== identityTreePathIndices[i];
        calculateOldIdentityTreeRoot.siblings[i] <== identityTreeSiblings[i];
    }

    component calculateNewIdentityTreeRoot = MerkleTreeInclusionProof(nLevels);
    calculateNewIdentityTreeRoot.leaf <== mixedTest.identityCommitment;
    for (var i = 0; i < nLevels; i++) {
        calculateNewIdentityTreeRoot.pathIndices[i] <== identityTreePathIndices[i];
        calculateNewIdentityTreeRoot.siblings[i] <== identityTreeSiblings[i];
    }

    component calculateGradeCommitmentIndex = PathIndicesToMemberIndex(nLevels);
    for (var i = 0; i < nLevels; i++) {
        calculateGradeCommitmentIndex.pathIndices[i] <== gradeTreePathIndices[i];
    }

    component calculateOldGradeTreeRoot = MerkleTreeInclusionProof(nLevels);
    calculateOldGradeTreeRoot.leaf <== gradeTreeEmptyLeaf;
    for (var i = 0; i < nLevels; i++) {
        calculateOldGradeTreeRoot.pathIndices[i] <== gradeTreePathIndices[i];
        calculateOldGradeTreeRoot.siblings[i] <== gradeTreeSiblings[i];
    }

    component calculateNewGradeTreeRoot = MerkleTreeInclusionProof(nLevels);
    calculateNewGradeTreeRoot.leaf <== mixedTest.gradeCommitment;
    for (var i = 0; i < nLevels; i++) {
        calculateNewGradeTreeRoot.pathIndices[i] <== gradeTreePathIndices[i];
        calculateNewGradeTreeRoot.siblings[i] <== gradeTreeSiblings[i];
    }
    
    identityCommitmentIndex <== calculateIdentityCommitmentIndex.out;
    identityCommitment <== mixedTest.identityCommitment;
    oldIdentityTreeRoot <== calculateOldIdentityTreeRoot.root;
    newIdentityTreeRoot <== calculateNewIdentityTreeRoot.root;

    gradeCommitmentIndex <== calculateGradeCommitmentIndex.out;
    gradeCommitment <== mixedTest.gradeCommitment;
    oldGradeTreeRoot <== calculateOldGradeTreeRoot.root;
    newGradeTreeRoot <== calculateNewGradeTreeRoot.root;

    testRoot <== mixedTest.testRoot;
    testParameters <== calculateTestParameters.out;
}

// Answer verifier for a maximum of 64 multiple choice questions and 64 open answer questions
component main = Test(6, 16);
