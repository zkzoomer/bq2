import { FullProof } from "@semaphore-protocol/proof"

export type BigNumberish = string | bigint | number

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
    multipleChoiceAnswers: string[] | string[][] | number[] | number[][],
    openAnswers: string[]
}

export type TestGradingVariables = {
    multipleChoiceWeight: number,
    nQuestions: number,
}

export type TestVariables = {
    minimumGrade: number,
    multipleChoiceWeight: number,
    nQuestions: number,
    multipleChoiceRoot: BigNumberish,
    openAnswersHashesRoot: BigNumberish,
    openAnswersHashes: BigNumberish[],
}

export type FullGradeCommitment = {
    gradeCommitmentValue: BigNumberish
    gradeCommitmentIndex: number
    grade: number
}

export type TestFullProof = {
    identityCommitment: string
    newIdentityTreeRoot: string
    gradeCommitment: string
    newGradeTreeRoot: string
    testPassed: boolean
    publicSignals: BigNumberish[]
    proof: Proof
}

export type CredentialRestrictedTestFullProof = {
    testFullProof: TestFullProof
    semaphoreFullProof: FullProof
}

export type GradeRestrictedTestFullProof = {
    testFullProof: TestFullProof
    gradeClaimFullProof: GradeClaimFullProof
}

export type GradeClaimFullProof = {
    gradeTreeRoot: BigNumberish,
    nullifierHash: BigNumberish,
    grade: number,
    gradeThreshold: BigNumberish,
    signal: BigNumberish,
    externalNullifier: BigNumberish,
    proof: Proof
}

export type RateFullProof = {
    rating: number,
    comment: string,
    semaphoreFullProof: FullProof
}

export type TestCredentialData = {
    testHeight: number,
    minimumGrade: number,
    multipleChoiceWeight: number,
    nQuestions: number,
    timeLimit: number,
    admin: string,
    requiredCredential: number,
    requiredCredentialGradeThreshold: number,
    multipleChoiceRoot: string,
    openAnswersHashesRoot: string,
    testRoot: string,
    testParameters: string,
    nonPassingTestParameters: string
}

export type OpenAnswersResults = {
    nCorrect: number,
    resultsArray: boolean[],
    openAnswersResult: number 
}

export type TestResults = {
    grade: number,
    minimumGrade: number,
    pass: boolean,
    nQuestions: number,
    multipleChoiceGrade: number,
    openAnswerGrade: number,
    multipleChoiceWeight: number,
    openAnswerResults: boolean[],
}

export type SolutionSnarkArtifacts = {
    testSnarkArtifacts: SnarkArtifacts,
    semaphoreSnarkArtifacts: SnarkArtifacts,
    gradeClaimSnarkArtifacts: SnarkArtifacts
}

export type Network =
    | "maticmum"

export type Options = {
    credentialsRegistryAddress?: string
    testCredentialManagerAddress?: string
    testCredentialType?: string
    openAnswersHashes?: string[]
    provider?: "etherscan" | "infura" | "alchemy" | "cloudflare" | "pocket" | "ankr"
    apiKey?: string
}
