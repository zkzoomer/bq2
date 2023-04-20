import { hash } from "@bq-core/lib";

export function generateMultipleChoiceAnswers( 
    multipleChoiceAnswers: number[] | number[][] | string[] | string[][], 
    testHeight: number 
): number[] {
    if (multipleChoiceAnswers.length > 2 ** testHeight ) {
        throw new Error("More answers were given than supported")
    }

    const answersArray = new Array(2 ** testHeight).fill('0')
    
    answersArray.forEach( (_, i) => {
        if ( i < multipleChoiceAnswers.length ) { 
            if (Array.isArray(multipleChoiceAnswers[i])) {
                answersArray[i] = (multipleChoiceAnswers[i] as string[] | number[]).sort().join('')
            } else {
                answersArray[i] = multipleChoiceAnswers[i].toString()
            }
        }
    })

    return answersArray
} 

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
