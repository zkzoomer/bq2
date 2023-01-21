pragma circom 2.0.0;

include "./verifiers/verify_multiple_choice.circom";

template MultipleChoiceTest(k) {
    var nQuestions = 2**k;

    // User's answers tree
    signal input answers[nQuestions];
    // Correct answers tree root, given by the smart contract
    signal input solutionHash;

    signal input identityNullifier;
    signal input identityTrapdoor;

    signal output identityCommitment;
    signal output scoreCommitment;

    component verifyMultipleChoice = VerifyMultipleChoice(k);
    verifyMultipleChoice.solutionHash <== solutionHash;
    for (var i = 0; i < nQuestions; i++) {
        verifyMultipleChoice.answers[i] <== answers[i];
    }

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateIdentityCommitment = CalculateIdentityCommitment();
    calculateIdentityCommitment.secret <== calculateSecret.out;

    component calculateScoreCommitment = Poseidon(2);
    calculateScoreCommitment.inputs[0] <== calculateSecret.out;
    // Multiple choice tests can only be passed if the user gets all the questions right
    calculateScoreCommitment.inputs[1] <== verifyMultipleChoice.score;

    identityCommitment <== calculateIdentityCommitment.out;
    scoreCommitment <== calculateScoreCommitment.out;
}

// Answer verifier for a maximum of 64 multiple choice questions
component main {public [solutionHash]} = MultipleChoiceTest(6);
