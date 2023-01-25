pragma circom 2.0.0;

template PathIndicesToMemberIndex(nLevels) {
    signal input pathIndices[nLevels];

    signal output out;

    var memberIndex = 0;

    for (var i = nLevels - 1; i >= 0; i--) {
        memberIndex += pathIndices[i] * 2 ** i;
    }

    out <== memberIndex;
}
