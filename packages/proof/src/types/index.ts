export type SnarkArtifacts = {
    wasmFilePath: string
    zkeyFilePath: string
}

export type SnarkJSProof = {
    pi_a: bigint[]
    pi_b: bigint[][]
    pi_c: bigint[]
    protocol: string
    curve: string
}

export type Proof = {
    a: [bigint, bigint],
    b: [[bigint, bigint], [bigint, bigint]],
    c: [bigint, bigint]
}

export type TestAnswers = {
    multipleChoiceAnswers: number[],
    openAnswers: bigint[]
}

export type TestStruct = {
    minimumGrade: number,
    multipleChoiceWeight: number,
    nQuestions: number,
    timeLimit: number,
    admin: string,
    multipleChoiceRoot: bigint,
    openAnswersHashesRoot: bigint,
    testRoot: bigint,
    testParameters: bigint,
}

export type UpdateGradeFullProof = {
    gradeCommitmentIndex: bigint
    oldGradeCommitment: bigint
    newGradeCommitment: bigint
    oldGradeTreeRoot: bigint
    newGradeTreeRoot: bigint
    testRoot: bigint
    testParameters: bigint
    publicSignals: bigint[]
    proof: Proof
}

export type TestFullProof = {
    identityCommitmentIndex: bigint
    identityCommitment: bigint
    oldIdentityTreeRoot: bigint
    newIdentityTreeRoot: bigint
    gradeCommitmentIndex: bigint
    gradeCommitment: bigint
    oldGradeTreeRoot: bigint
    newGradeTreeRoot: bigint
    testRoot: bigint
    testParameters: bigint
    publicSignals: bigint[]
    proof: Proof
}
