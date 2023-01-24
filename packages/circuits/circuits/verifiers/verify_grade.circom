pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../lib/merkle_inclusion.circom";
include "../lib/semaphore_identity.circom";

template VerifyGrade(nLevels) {
    signal input identityNullifier;
    signal input identityTrapdoor;
    signal input treePathIndices[nLevels];
    signal input treeSiblings[nLevels];

    signal input grade;

    signal output root;
    signal output identitySecret;

    component calculateSecret = CalculateSecret();
    calculateSecret.identityNullifier <== identityNullifier;
    calculateSecret.identityTrapdoor <== identityTrapdoor;

    component calculateGradeCommitment = Poseidon(2);
    calculateGradeCommitment.inputs[0] <== calculateSecret.out;
    calculateGradeCommitment.inputs[1] <== grade;

    component inclusionProof = MerkleTreeInclusionProof(nLevels);
    inclusionProof.leaf <== calculateGradeCommitment.out;

    for (var i = 0; i < nLevels; i++) {
        inclusionProof.siblings[i] <== treeSiblings[i];
        inclusionProof.pathIndices[i] <== treePathIndices[i];
    }

    root <== inclusionProof.root;
    identitySecret <== calculateSecret.out;
}
