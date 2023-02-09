import { utils } from "ethers";
import { TEST_HEIGHT } from "../constants";

export default function generateOpenAnswers( openAnswers: string[] ): bigint[] {
    if (openAnswers.length > 2 ** TEST_HEIGHT ) {
        throw new Error("More answers were given than supported")
    }

    const resultsArray: bigint[] = new Array(64).fill(
        BigInt(utils.keccak256(utils.toUtf8Bytes("")))
    );

    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = BigInt(utils.keccak256(utils.toUtf8Bytes(openAnswers[i])))
    }});

    return resultsArray;
}