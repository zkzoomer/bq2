import { hash } from "@bq2/lib";

export function generateOpenAnswers( openAnswers: string[], testHeight: number ): string[] {
    if (openAnswers.length > 2 ** testHeight ) {
        throw new Error("More answers were given than supported")
    }

    const resultsArray = new Array(2 ** testHeight).fill(
        hash("")
    );

    resultsArray.forEach( (_, i) => { if (i < openAnswers.length) {
        resultsArray[i] = hash(openAnswers[i])
    }});

    return resultsArray;
}
