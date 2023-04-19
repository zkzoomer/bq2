import { AbiCoder } from 'ethers';
import { CredentialState, TestCredentialData } from '../types';

const abi = new AbiCoder()

export function decodeTestCredentialData(
    data: string
): TestCredentialData {
    const decodedData = abi.decode(
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
            "uint256",
            "uint256",
            "uint256",
            "uint256"
        ],
        data
    )

    return {
        testHeight: parseFloat(decodedData[0].toString()),
        minimumGrade: parseFloat(decodedData[1].toString()),
        multipleChoiceWeight: parseFloat(decodedData[2].toString()),
        nQuestions: parseFloat(decodedData[3].toString()),
        timeLimit: parseFloat(decodedData[4].toString()),
        admin: decodedData[5].toString(),
        requiredCredential: parseFloat(decodedData[6].toString()),
        requiredCredentialGradeThreshold: parseFloat(decodedData[7].toString()),
        multipleChoiceRoot: decodedData[8].toString(),
        openAnswersHashesRoot: decodedData[9].toString(),
        testRoot: decodedData[10].toString(),
        testParameters: decodedData[11].toString(),
        nonPassingTestParameters: decodedData[12].toString()
    }
}

export function decodeLegacyCredentialData(
    data: string
): { credentialState: CredentialState, minimumGrade: number } {
    const decodedData = abi.decode(
        [
            "uint80",
            "uint80",
            "uint80",
            "uint256",
            "uint256",
            "uint256",
            "uint256"
        ],
        data
    )

    return {
        credentialState: {
            gradeTreeIndex: decodedData[0].toNumber(),
            credentialsTreeIndex: decodedData[1].toNumber(),
            noCredentialsTreeIndex: decodedData[2].toNumber(),
            gradeTreeRoot: decodedData[3].toString(),
            credentialsTreeRoot: decodedData[4].toString(),
            noCredentialsTreeRoot: decodedData[5].toString(),
        },
        minimumGrade: decodedData[6].toNumber()
    }
}
