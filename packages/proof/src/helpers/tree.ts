import { HashFunction } from "@zk-kit/incremental-merkle-tree"

function pairwiseHash(hash: HashFunction, array: number[] | BigInt[]): BigInt[] {
    const arrayHash: BigInt[] = []
    for (let i = 0; i < array.length; i = i + 2){
        arrayHash.push(hash([array[i], array[i+1]]));
    }
    return arrayHash
}

export default function rootFromLeafArray(hash: HashFunction, leafArray: number[] | BigInt[]): BigInt {
    const depth = Math.log(leafArray.length) / Math.log(2)
    const tree: BigInt[][] = Array(depth);
    tree[depth - 1] = pairwiseHash(hash, leafArray)
    for (let j = depth - 2; j >= 0; j--){
        tree[j] = pairwiseHash(hash, tree[j+1])
    }

    return tree[0][0]
}
