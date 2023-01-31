import { keccak256 } from 'js-sha3';

export default function generateOpenAnswers( openAnswers: string[] ): BigInt[] {
    const resultsArray: BigInt[] = new Array(64).fill(
        BigInt('0x' + keccak256(""))
    )
    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = BigInt('0x' + keccak256(openAnswers[i]))
    }})
    return resultsArray
}