import { utils } from 'ethers';
import { TestCredentialData } from '../types';

const abi = utils.defaultAbiCoder

export function decodeTestData(
    data: string
): TestCredentialData {
    const decodedData = abi.decode(
        [
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
        minimumGrade: decodedData[0].toNumber(),
        multipleChoiceWeight: decodedData[1].toNumber(),
        nQuestions: decodedData[2].toNumber(),
        timeLimit: decodedData[3].toNumber(),
        admin: decodedData[4],
        requiredCredential: decodedData[5].toNumber(),
        requiredCredentialGradeThreshold: decodedData[6].toNumber(),
        multipleChoiceRoot: decodedData[7].toString(),
        openAnswersHashesRoot: decodedData[8].toString(),
        testRoot: decodedData[9].toString(),
        testParameters: decodedData[10].toString(),
        nonPassingTestParameters: decodedData[11].toString()
    }
}