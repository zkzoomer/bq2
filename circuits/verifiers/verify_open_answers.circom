pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../common/get_merkle_root.circom";

template VerifyOpenAnswers(k) {
    var nQuestions = 2**k;
    
    signal input answers[nQuestions];
    signal input answersHashes[nQuestions];
    signal input answersHashesRoot;

    signal output nCorrect;

    // Corresponds to the Merkle root of putting the answers hashes into a tree, checked at smart contract for correctness
    component merkleRoot = GetMerkleRoot(k);
    for (var i = 0; i < nQuestions; i++) {
        merkleRoot.leaves[i] <== answersHashes[i];
    }
    answersHashesRoot === merkleRoot.out;

    // Each question requires a proof that the solver has a preimage that results in a given hash, and this hash
    // needs to be compared with the correct answer hash - this will grant a point
    var _nCorrect = 0;  
    component hashers[nQuestions];
    component comparators[nQuestions];

    for (var i = 0; i < nQuestions; i++) {
        hashers[i] = Poseidon(1);
        comparators[i] = IsEqual();

        hashers[i].inputs[0] <== answers[i];
        comparators[i].in[0] <== answersHashes[i];
        comparators[i].in[1] <== hashers[i].out;

        _nCorrect += comparators[i].out;
    }   

    nCorrect <== _nCorrect;
}