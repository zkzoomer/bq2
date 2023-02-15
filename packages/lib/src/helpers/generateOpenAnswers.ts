import { TEST_HEIGHT } from "../constants";
import hash from "./hash";

export default function generateOpenAnswers( openAnswers: string[] ): bigint[] {
    if (openAnswers.length > 2 ** TEST_HEIGHT ) {
        throw new Error("More answers were given than supported")
    }

    const resultsArray: bigint[] = new Array(64).fill(
        hash("")
    );

    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = hash(openAnswers[i])
    }});

    return resultsArray;
}