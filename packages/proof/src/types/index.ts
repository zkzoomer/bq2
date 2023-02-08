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

export type TestAnswers = {
    multipleChoiceAnswers: number[],
    openAnswers: BigNumberish[]
}

export type TestVariables = {
    minimumGrade: number,
    multipleChoiceWeight: number,
    nQuestions: number,
    multipleChoiceRoot: BigNumberish,
    openAnswersHashesRoot: BigNumberish,
    openAnswersHashes: BigNumberish[],
}

export type GradeCommitment = {
    gradeCommitmentValue: BigNumberish
    gradeCommitmentIndex: number
    weightedGrade: number
    grade: number
}

export type TestFullProof = {
    identityCommitment: BigNumberish
    newIdentityTreeRoot: BigNumberish
    gradeCommitment: BigNumberish
    newGradeTreeRoot: BigNumberish
    publicSignals: BigNumberish[]
    proof: Proof
}

export type GradeClaimFullProof = {
    gradeTreeRoot: BigNumberish,
    nullifierHash: BigNumberish,
    gradeThreshold: BigNumberish,
    signal: BigNumberish,
    externalNullifier: BigNumberish,
    proof: Proof
}