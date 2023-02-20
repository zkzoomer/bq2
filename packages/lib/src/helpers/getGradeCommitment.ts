import { Group, Member } from "@semaphore-protocol/group"
import type { Identity } from "@semaphore-protocol/identity"
import { TEST_HEIGHT } from "../constants";
import { Poseidon, buildPoseidon } from "./buildPoseidon";
import { FullGradeCommitment, TestVariables } from "../types";

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

    let gradeCommitmentValue: bigint;
    let gradeCommitmentIndex: number;
    let weightedGrade: number;
    let grade: number;

    // There are 2 ** (TEST_HEIGHT + 1) + 2 possible grades the user might have obtained, we simply have to iterate through these and find if the grade commitment is in the tree
    var i = 0, n = 2 ** TEST_HEIGHT;
    while (i <= n) {
        grade = Math.floor((100 - multipleChoiceWeight) * i / nQuestions)
        weightedGrade = grade * nQuestions
        gradeCommitmentValue = poseidon([identitySecret, weightedGrade])
        gradeCommitmentIndex = gradeGroup.indexOf(gradeCommitmentValue)
        
        if (gradeCommitmentIndex !== -1) {
            return {
                gradeCommitmentValue,
                gradeCommitmentIndex,
                weightedGrade,
                grade
            }
        }

        grade += multipleChoiceWeight
        weightedGrade = grade * nQuestions
        gradeCommitmentValue = poseidon([identitySecret, weightedGrade])
        gradeCommitmentIndex = gradeGroup.indexOf(gradeCommitmentValue)

        if (gradeCommitmentIndex !== -1) {
            return {
                gradeCommitmentValue,
                gradeCommitmentIndex,
                weightedGrade,
                grade
            }
        }

        i++;
    }

    throw new Error("The user did not obtain a grade for this test")
}
