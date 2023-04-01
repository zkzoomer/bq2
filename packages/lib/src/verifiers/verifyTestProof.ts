import { SUPPORTED_TEST_HEIGHTS, TestFullProof } from "@bq2/lib"
import { groth16 } from "snarkjs"
import { unpackProof } from "../helpers"
import testKeys from "../../verification-keys/testKeys.json"

/**
 * Verifies a a proof of knowledge of a solution to a Block Qualified test.
 * @param fullProof The SnarkJS proof of knowledge.
 * @returns True if the proof is valid, false otherwise.
 */
export default function verifyTestProof(
    { publicSignals, proof }: TestFullProof,
    testHeight: number
): Promise<boolean> {
    if (!SUPPORTED_TEST_HEIGHTS.includes(testHeight)) {
        throw new TypeError("The test height given is not supported")
    }

    const verificationKey = {
        ...testKeys,
        vk_delta_2: testKeys.vk_delta_2[testHeight - 4],
        IC: testKeys.IC[testHeight - 4]
    }

    return groth16.verify(
        verificationKey,
        publicSignals,
        unpackProof(proof)
    )
}
