import { BigNumber } from "ethers";
import { keccak256 } from 'js-sha3';

export function generateOpenAnswers( openAnswers: string[] ): BigNumber[] {
    const resultsArray: BigNumber[] = new Array(64).fill(
        BigNumber.from('0x' + keccak256(""))
    )
    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = BigNumber.from('0x' + keccak256(openAnswers[i]))
    }})
    return resultsArray
}