pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "./common/get_merkle_root.circom";
include "./common/semaphore_identity.circom";

template VerifyOpenAnswers(k) {
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

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateIdentityCommitment = CalculateIdentityCommitment();
    calculateIdentityCommitment.secret <== calculateSecret.out;

    // Corresponds to the Merkle root of putting the answers hashes into a tree, checked at smart contract for correctness
    component merkleRoot = GetMerkleRoot(k);
    for (var i = 0; i < nQuestions; i++) {
        merkleRoot.leaves[i] <== answersHashes[i];
    }
    answersHashesRoot === merkleRoot.out;

    // Each question requires a proof that the solver has a preimage that results in a given hash, and this hash
    // needs to be compared with the correct answer hash - this will grant a point
    var correctNumber = 0;  
    component hashers[nQuestions];
    component comparators[nQuestions];

    for (var i = 0; i < nQuestions; i++) {
        hashers[i] = Poseidon(1);
        comparators[i] = IsEqual();

        hashers[i].inputs[0] <== answers[i];
        comparators[i].in[0] <== answersHashes[i];
        comparators[i].in[1] <== hashers[i].out;

        correctNumber += comparators[i].out;
    }   

    component calculateScoreCommitment = Poseidon(2);
    calculateScoreCommitment.inputs[0] <== calculateSecret.out;
    calculateScoreCommitment.inputs[1] <== correctNumber;

    identityCommitment <== calculateIdentityCommitment.out;
    scoreCommitment <== calculateScoreCommitment.out;
}