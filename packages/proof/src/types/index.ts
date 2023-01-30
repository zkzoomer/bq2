export type BigNumberish = string | bigint

export type SnarkArtifacts = {
    wasmFilePath: string
    zkeyFilePath: string
}

export type SnarkJSProof = {
    pi_a: BigNumberish[]
    pi_b: BigNumberish[][]
    pi_c: BigNumberish[]
    protocol: string
    curve: string
}

export type Proof = [
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
]

export type GradeUpdateFullProof = {
    gradeCommitmentIndex: BigNumberish
    oldGradeCommitment: BigNumberish
    newGradeCommitment: BigNumberish
    oldGradeTreeRoot: BigNumberish
    newGradeTreeRoot: BigNumberish
    testRoot: BigNumberish
    testParameters: BigNumberish
    proof: Proof
}

export type TestFullProof = {
    identityCommitmentIndex: BigNumberish
    identityCommitment: BigNumberish
    oldIdentityTreeRoot: BigNumberish
    newIdentityTreeRoot: BigNumberish
    gradeCommitmentIndex: BigNumberish
    gradeCommitment: BigNumberish
    oldGradeTreeRoot: BigNumberish
    newGradeTreeRoot: BigNumberish
    testRoot: BigNumberish
    testParameters: BigNumberish
    proof: Proof
}

export type TestAnswers = {
    multipleChoiceAnswers: number[],
    openAnswers: BigNumberish[]
}

export type TestParameters = {
    minimumGrade: number,
    multipleChoiceWeight: number,
    nQuestions: number,
    solutionHash: BigNumberish,
    openAnswersHashes: BigNumberish[],
    openAnswersHashesRoot: BigNumberish,
}
