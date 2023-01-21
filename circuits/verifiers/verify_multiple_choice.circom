pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "./common/get_merkle_root.circom";
include "./common/semaphore_identity.circom";

template VerifyMultipleChoice(k) {
    var nQuestions = 2**k;

    // User's answers tree
    signal input answers[nQuestions];
    // Correct answers tree root, given by the smart contract
    signal input solutionHash;

    signal input identityNullifier;
    signal input identityTrapdoor;

    signal output identityCommitment;
    signal output scoreCommitment;

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateIdentityCommitment = CalculateIdentityCommitment();
    calculateIdentityCommitment.secret <== calculateSecret.out;

    // Merkle root of the user's answers
    component merkleRoot = GetMerkleRoot(k);
    for (var i = 0; i < nQuestions; i++) {
        merkleRoot.leaves[i] <== answers[i];
    }

    component testPassed = IsEqual();
    testPassed.in[0] <== merkleRoot.out;
    testPassed.in[1] <== solutionHash;

    component calculateScoreCommitment = Poseidon(2);
    calculateScoreCommitment.inputs[0] <== calculateSecret.out;
    // Multiple choice tests can only be passed if the user gets all the questions right
    calculateScoreCommitment.inputs[1] <== 100 * testPassed.out;

    identityCommitment <== calculateIdentityCommitment.out;
    scoreCommitment <== calculateScoreCommitment.out;
}