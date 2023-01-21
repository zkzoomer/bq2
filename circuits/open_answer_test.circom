pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "./verifiers/verify_open_answers.circom";
include "./common/semaphore_identity.circom";

template OpenAnswerTest(k) {
    var nQuestions = 2**k;
    
    // User's answers tree
    signal input answers[nQuestions];
    // Correct answers hashes tree
    signal input answersHashes[nQuestions];
    // Correct answers hashes tree root, given by the smart contract
    signal input answersHashesRoot;

    signal input identityNullifier;
    signal input identityTrapdoor;

    signal output identityCommitment;
    // The score commitment represents the number of correct answers given
    signal output scoreCommitment;

    component verifyOpenAnswers = VerifyOpenAnswers(k);
    verifyOpenAnswers.answersHashesRoot <== answersHashesRoot;
    for (var i = 0; i < nQuestions; i++) {
        verifyOpenAnswers.answers[i] <== answers[i];
        verifyOpenAnswers.answersHashes[i] <== answersHashes[i];
    }

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateIdentityCommitment = CalculateIdentityCommitment();
    calculateIdentityCommitment.secret <== calculateSecret.out;

    component calculateScoreCommitment = Poseidon(2);
    calculateScoreCommitment.inputs[0] <== calculateSecret.out;
    calculateScoreCommitment.inputs[1] <== verifyOpenAnswers.nCorrect;

    identityCommitment <== calculateIdentityCommitment.out;
    scoreCommitment <== calculateScoreCommitment.out;
}

// Answer verifier for a maximum of 64 open answer questions
component main {public [answersHashesRoot]} = OpenAnswerTest(6);