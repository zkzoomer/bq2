pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../lib/get_merkle_root.circom";

template VerifyMultipleChoice(k) {
    var nQuestions = 2**k;

    signal input answers[nQuestions];
    signal input solutionHash;

    signal output result;

    // Merkle root of the user's answers
    component merkleRoot = GetMerkleRoot(k);
    for (var i = 0; i < nQuestions; i++) {
        merkleRoot.leaves[i] <== answers[i];
    }

    component testPassed = IsEqual();
    testPassed.in[0] <== merkleRoot.out;
    testPassed.in[1] <== solutionHash;

    result <== 100 * testPassed.out;
}
