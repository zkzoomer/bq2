pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template HashLeftRight() {
    signal input left;
    signal input right;

    signal output digest;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;

    digest <== hasher.out;
}

// Gets the root of a given Merkle tree, where k is its depth
template GetMerkleRoot(k) {
    var nLeaves = 2**k;

    signal input leaves[nLeaves];
    
    // Directly above these 2**k leaves there are 2**k / 2 = 2**(k - 1) nodes
    // These are the number of components that will be used to hash just the leaves
    var nLeafHashers = nLeaves / 2;

    // Above these mentioned nodes we will have a total of 2**k / 2 - 1 nodes
    // These are the number of components that will be used to hash the outputs of the nodes above
    var nNodeHashers = nLeaves / 2 - 1;

    // The total number of hashers needed will be nLeafHashers + nNodeHashers = nLeaves - 1
    var nHashers = nLeaves - 1;
    component hashers[nHashers];

    signal output out;

    for (var i = 0; i < nHashers; i++) {
        hashers[i] = HashLeftRight();
    }

    for (var i = 0; i < nLeafHashers; i++) {
        hashers[i].left <== leaves[2*i];
        hashers[i].right <== leaves[2*i + 1];
    }

    var j = 0;
    for (var i = nLeafHashers; i < nLeafHashers + nNodeHashers; i++) {
        hashers[i].left <== hashers[j*2].digest;
        hashers[i].right <== hashers[j*2 + 1].digest;
        j++;
    }

    out <== hashers[nHashers - 1].digest;
}