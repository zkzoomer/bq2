import { hash, TEST_HEIGHT } from "@bq2/lib";

export function generateOpenAnswers( openAnswers: string[] ): string[] {
    if (openAnswers.length > 2 ** TEST_HEIGHT ) {
        throw new Error("More answers were given than supported")
    }

    const resultsArray = new Array(64).fill(
        hash("")
    );

    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = hash(openAnswers[i])
    }});

    return resultsArray;
}
