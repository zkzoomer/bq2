pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./verifiers/verify_mixed_test.circom";

template bqTest(k) {
    var maxQuestions = 2**k;

    // Test parameters
    signal input minimumGrade;
    signal input multipleChoiceWeight;
    signal input nQuestions;

    // User's multiple choice answers tree
    signal input multipleChoiceAnswers[maxQuestions];
    // Correct multiple choice answers tree root, given by the smart contract
    signal input solutionHash;

    // User's answers tree
    signal input openAnswers[maxQuestions];
    // Correct answers hashes tree
    signal input openAnswersHashes[maxQuestions];
    // Correct answers hashes tree root, given by the smart contract
    signal input openAnswersHashesRoot;

    signal input identitySecret;
    
    signal output testRoot;
    signal output identityCommitment;
    signal output gradeCommitment;
    signal output testParameters;

    component mixedTest = VerifyMixedTest(k);
    mixedTest.minimumGrade <== minimumGrade;
    mixedTest.multipleChoiceWeight <== multipleChoiceWeight;
    mixedTest.nQuestions <== nQuestions;
    mixedTest.solutionHash <== solutionHash;
    for (var i = 0; i < maxQuestions; i++) {
        mixedTest.multipleChoiceAnswers[i] <== multipleChoiceAnswers[i];
        mixedTest.openAnswersHashes[i] <== openAnswersHashes[i];
        mixedTest.openAnswers[i] <== openAnswers[i];
    }
    mixedTest.openAnswersHashesRoot <== openAnswersHashesRoot;
    mixedTest.identitySecret <== identitySecret;

    component calculateTestParameters = Poseidon(3);
    calculateTestParameters.inputs[0] <== minimumGrade;
    calculateTestParameters.inputs[1] <== multipleChoiceWeight;
    calculateTestParameters.inputs[2] <== nQuestions;
    
    testRoot <== mixedTest.testRoot;
    identityCommitment <== mixedTest.identityCommitment;
    gradeCommitment <== mixedTest.gradeCommitment;
    testParameters <== calculateTestParameters.out;
}

// Answer verifier for a maximum of 64 multiple choice questions and 64 open answer questions
component main = bqTest(6);
