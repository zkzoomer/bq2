pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../lib/get_merkle_root.circom";

template VerifyMultipleChoice(testHeight) {
    var nQuestions = 2**testHeight;

    signal input answers[nQuestions];
    signal input multipleChoiceRoot;

    signal output result;

    // Merkle root of the user's answers
    component merkleRoot = GetMerkleRoot(testHeight);
    for (var i = 0; i < nQuestions; i++) {
        merkleRoot.leaves[i] <== answers[i];
    }

    component testPassed = IsEqual();
    testPassed.in[0] <== merkleRoot.out;
    testPassed.in[1] <== multipleChoiceRoot;

    result <== testPassed.out;
}
