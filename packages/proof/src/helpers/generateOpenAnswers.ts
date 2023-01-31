import { BigNumber, utils } from "ethers"

export default function generateOpenAnswers( openAnswers: string[] ): bigint[] {
    const resultsArray: bigint[] = new Array(64).fill(
        BigInt(utils.keccak256(utils.toUtf8Bytes("")))
    )
    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = BigInt(utils.keccak256(utils.toUtf8Bytes(openAnswers[i])))
    }})
    return resultsArray
}