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
        testHeight: decodedData[0],
        minimumGrade: decodedData[1],
        multipleChoiceWeight: decodedData[2],
        nQuestions: decodedData[3],
        timeLimit: decodedData[4],
        admin: decodedData[5],
        requiredCredential: decodedData[6].toNumber(),
        requiredCredentialGradeThreshold: decodedData[7].toNumber(),
        multipleChoiceRoot: decodedData[8].toString(),
        openAnswersHashesRoot: decodedData[9].toString(),
        testRoot: decodedData[10].toString(),
        testParameters: decodedData[11].toString(),
        nonPassingTestParameters: decodedData[12].toString()
    }
}
