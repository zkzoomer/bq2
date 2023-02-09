import { HashFunction } from "@zk-kit/incremental-merkle-tree"
import { BigNumber, BigNumberish } from "ethers"

function pairwiseHash(hash: HashFunction, array: BigNumberish[]): bigint[] {
    const arrayHash: bigint[] = []
    for (let i = 0; i < array.length; i = i + 2){
        arrayHash.push(hash([array[i], array[i+1]]));
    }
    return arrayHash
}

export default function rootFromLeafArray(hash: HashFunction, leafArray: BigNumberish[]): bigint {
    const depth = Math.log(leafArray.length) / Math.log(2)
    const tree: bigint[][] = Array(depth);
    tree[depth - 1] = pairwiseHash(hash, leafArray)
    for (let j = depth - 2; j >= 0; j--){
        tree[j] = pairwiseHash(hash, tree[j+1])
    }

    return tree[0][0]
}
