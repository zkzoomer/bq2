import { utils } from 'ethers';
import { CredentialRestrictedTestFullProof, GradeRestrictedTestFullProof, Proof, TestFullProof } from '../types';

const abi = utils.defaultAbiCoder

export function encodeTestInitializingParameters(
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
    admin = utils.getAddress(admin)

    return abi.encode(
        [
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
