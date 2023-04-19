import { AbiCoder, getAddress } from 'ethers';
import { CredentialRestrictedTestFullProof, GradeRestrictedTestFullProof, Proof, TestFullProof } from '../types';

const abi = new AbiCoder()

export function encodeTestCredential(
    testHeight: number,
    minimumGrade: number,
    multipleChoiceWeight: number,
    nQuestions: number,
    timeLimit: number,
    admin: string,
    requiredCredential: number,
    requiredCredentialGradeThreshold: number,
    multipleChoiceRoot: string,
    openAnswersHashesRoot: string
): string {
    // Ensures it was given a valid address
    admin = getAddress(admin)

    return abi.encode(
        [
            "uint8",
            "uint8", 
            "uint8", 
            "uint8", 
            "uint32", 
            "address", 
            "uint256", 
            "uint256", 
            "uint256", 
            "uint256"
        ], 
        [
            testHeight,
            minimumGrade,
            multipleChoiceWeight,
            nQuestions,
            timeLimit,
            admin,
            requiredCredential,
            requiredCredentialGradeThreshold,
            multipleChoiceRoot,
            openAnswersHashesRoot
        ]
    )
}

export function encodeLegacyCredential(
    gradeTreeIndex: number,
    credentialsTreeIndex: number,
    noCredentialsTreeIndex: number,
    gradeTreeRoot: string,
    credentialsTreeRoot: string,
    noCredentialsTreeRoot: string,
    minimumGrade?: number
): string {
    return minimumGrade ?
        abi.encode(
            [
                "uint80",
                "uint80",
                "uint80",
                "uint256",
                "uint256",
                "uint256",
                "uint256"
            ],
            [
                gradeTreeIndex,
                credentialsTreeIndex,
                noCredentialsTreeIndex,
                gradeTreeRoot,
                credentialsTreeRoot,
                noCredentialsTreeRoot,
                minimumGrade
            ]
        )
    :
        abi.encode(
            [
                "uint80",
                "uint80",
                "uint80",
                "uint256",
                "uint256",
                "uint256",
            ],
            [
                gradeTreeIndex,
                credentialsTreeIndex,
                noCredentialsTreeIndex,
                gradeTreeRoot,
                credentialsTreeRoot,
                noCredentialsTreeRoot
            ]
        )
}

export function encodeTestFullProof(
    testFullProof: TestFullProof
): string {
    return abi.encode(
        [
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256[8]",
            "bool"
        ],
        [
            testFullProof.identityCommitment,
            testFullProof.newIdentityTreeRoot,
            testFullProof.gradeCommitment,
            testFullProof.newGradeTreeRoot,
            testFullProof.proof,
            testFullProof.testPassed
        ]
    )
}

export function encodeCredentialRestrictedTestFullProof(
    { testFullProof, semaphoreFullProof }: CredentialRestrictedTestFullProof
): string {
    return abi.encode(
        [
            "uint256", 
            "uint256", 
            "uint256[8]",
            "uint256",
            "uint256",
            "uint256", 
            "uint256", 
            "uint256[8]", 
            "bool",
        ],
        [
            semaphoreFullProof.merkleTreeRoot,
            semaphoreFullProof.nullifierHash,
            semaphoreFullProof.proof,
            testFullProof.identityCommitment,
            testFullProof.newIdentityTreeRoot,
            testFullProof.gradeCommitment,
            testFullProof.newGradeTreeRoot,
            testFullProof.proof,
            testFullProof.testPassed
        ]
    )
}

export function encodeGradeRestrictedTestFullProof(
    { testFullProof, gradeClaimFullProof }: GradeRestrictedTestFullProof
): string {
    return abi.encode(
        [
            "uint256",
            "uint256", 
            "uint256[8]",
            "uint256", 
            "uint256", 
            "uint256", 
            "uint256", 
            "uint256[8]", 
            "bool",
        ],
        [
            gradeClaimFullProof.gradeTreeRoot,
            gradeClaimFullProof.nullifierHash,
            gradeClaimFullProof.proof,
            testFullProof.identityCommitment,
            testFullProof.newIdentityTreeRoot,
            testFullProof.gradeCommitment,
            testFullProof.newGradeTreeRoot,
            testFullProof.proof,
            testFullProof.testPassed
        ]
    )
}
