pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "./verifiers/verify_multiple_choice.circom";
include "./verifiers/verify_open_answers.circom";
include "./lib/semaphore_identity.circom";

template MixedTest(k) {
    var nQuestions = 2**k;

    // User's multiple choice answers tree
    signal input multipleChoiceAnswers[nQuestions];
    // Correct multiple choice answers tree root, given by the smart contract
    signal input solutionHash;

    // User's answers tree
    signal input openAnswers[nQuestions];
    // Correct answers hashes tree
    signal input openAnswersHashes[nQuestions];
    // Correct answers hashes tree root, given by the smart contract
    signal input openAnswersHashesRoot;

    signal input identityNullifier;
    signal input identityTrapdoor;

    signal output identityCommitment;
    signal output gradeCommitment;

    component verifyMultipleChoice = VerifyMultipleChoice(k);
    verifyMultipleChoice.solutionHash <== solutionHash;
    for (var i = 0; i < nQuestions; i++) {
        verifyMultipleChoice.answers[i] <== multipleChoiceAnswers[i];
    }

    component verifyOpenAnswers = VerifyOpenAnswers(k);
    verifyOpenAnswers.answersHashesRoot <== openAnswersHashesRoot;
    for (var i = 0; i < nQuestions; i++) {
        verifyOpenAnswers.answers[i] <== openAnswers[i];
        verifyOpenAnswers.answersHashes[i] <== openAnswersHashes[i];
    }

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateIdentityCommitment = CalculateIdentityCommitment();
    calculateIdentityCommitment.secret <== calculateSecret.out;

    component calculateGradeCommitment = Poseidon(2);
    calculateGradeCommitment.inputs[0] <== calculateSecret.out;
    calculateGradeCommitment.inputs[1] <== verifyOpenAnswers.nCorrect + verifyMultipleChoice.result;

    identityCommitment <== calculateIdentityCommitment.out;
    gradeCommitment <== calculateGradeCommitment.out;
}

// Answer verifier for a maximum of 64 multiple choice questions and 64 open answer questions
component main {public [solutionHash, openAnswersHashesRoot]} = MixedTest(6);