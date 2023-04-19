import { buildPoseidon, FullGradeCommitment, Poseidon, BigNumberish } from "@bq-core/lib"
import { Group } from "@semaphore-protocol/group"
import type { Identity } from "@semaphore-protocol/identity"

/**
 * Finds the grade a user obtained from their identity and grade group by doing a brute force search through all the possible grades they could obtain.
 * @param gradeGroup The Semaphore group for the grade group.
 * @param identity The Semaphore identity that will be associated with the solution.
 * @param multipleChoiceWeight: Contribution of the multiple choice component towards the final grade.
 * @param nQuestions: Number of questions that make up the open answer component.
 * @returns The grade the user obtained.
 */
export async function getGradeCommitment(
    { trapdoor, nullifier }: Identity,
    gradeGroup: Group,
    multipleChoiceWeight: number,
    nQuestions: number,
): Promise<FullGradeCommitment> {
    let poseidon: Poseidon = await buildPoseidon();

    let identitySecret = poseidon([nullifier, trapdoor])

    let gradeCommitmentValue: BigNumberish;
    let gradeCommitmentIndex: number;
    let grade: number;

    var i = 0;
    while (i <= nQuestions) {
        grade = Math.floor((100 - multipleChoiceWeight) * i / nQuestions) 
        gradeCommitmentValue = poseidon([identitySecret, grade])
        gradeCommitmentIndex = 
            gradeGroup.indexOf(gradeCommitmentValue) === -1 ? 
            gradeGroup.indexOf(gradeCommitmentValue.toString()) : 
            gradeGroup.indexOf(gradeCommitmentValue)
        
        if (gradeCommitmentIndex !== -1) {
            return {
                gradeCommitmentValue,
                gradeCommitmentIndex,
                grade: grade * nQuestions
            }
        }

        grade += multipleChoiceWeight
        gradeCommitmentValue = poseidon([identitySecret, grade])
        gradeCommitmentIndex = 
            gradeGroup.indexOf(gradeCommitmentValue) === -1 ?
            gradeGroup.indexOf(gradeCommitmentValue.toString()) : 
            gradeGroup.indexOf(gradeCommitmentValue)

        if (gradeCommitmentIndex !== -1) {
            return {
                gradeCommitmentValue,
                gradeCommitmentIndex,
                grade
            }
        }

        i++;
    }

    throw new Error("The user did not obtain a grade for this test")
}
