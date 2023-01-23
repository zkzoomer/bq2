pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/comparators.circom";
include "./node_modules/circomlib/circuits/poseidon.circom";
include "./verifiers/verify_multiple_choice.circom";
include "./verifiers/verify_open_answers.circom";
include "./lib/semaphore_identity.circom";
include "./lib/get_grade.circom";

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

    component verifyMultipleChoice = VerifyMultipleChoice(k);
    verifyMultipleChoice.solutionHash <== solutionHash;
    for (var i = 0; i < maxQuestions; i++) {
        verifyMultipleChoice.answers[i] <== multipleChoiceAnswers[i];
    }

    component verifyOpenAnswers = VerifyOpenAnswers(k);
    verifyOpenAnswers.answersHashesRoot <== openAnswersHashesRoot;
    for (var i = 0; i < maxQuestions; i++) {
        verifyOpenAnswers.answers[i] <== openAnswers[i];
        verifyOpenAnswers.answersHashes[i] <== openAnswersHashes[i];
    }

    component testGrade = GetGrade(maxQuestions);
    testGrade.multipleChoiceResult <== verifyMultipleChoice.result;
    testGrade.nCorrectOpenAnswers <== verifyOpenAnswers.nCorrect;
    testGrade.multipleChoiceWeight <== multipleChoiceWeight;
    testGrade.nQuestions <== nQuestions; 

    component passedTest = GreaterEqThan(13);  // Max value is 100 * 64 = 6400 < 2**13 - 1 = 8191
    passedTest.in[0] <== testGrade.out;
    passedTest.in[1] <== minimumGrade * nQuestions;

    passedTest.out === 1;

    component calculateTestRoot = Poseidon(2);
    calculateTestRoot.inputs[0] <== solutionHash;
    calculateTestRoot.inputs[1] <== openAnswersHashesRoot;

    component calculateIdentityCommitment = CalculateIdentityCommitment();
    calculateIdentityCommitment.secret <== identitySecret;

    component calculateGradeCommitment = Poseidon(2);
    calculateGradeCommitment.inputs[0] <== identitySecret;
    calculateGradeCommitment.inputs[1] <== testGrade.out;

    component calculateTestParameters = Poseidon(3);
    calculateTestParameters.inputs[0] <== minimumGrade;
    calculateTestParameters.inputs[1] <== multipleChoiceWeight;
    calculateTestParameters.inputs[2] <== nQuestions;
    
    testRoot <== calculateTestRoot.out;
    identityCommitment <== calculateIdentityCommitment.out;
    gradeCommitment <== calculateGradeCommitment.out;
    testParameters <== calculateTestParameters.out;
}

// Answer verifier for a maximum of 64 multiple choice questions and 64 open answer questions
component main = bqTest(6);
