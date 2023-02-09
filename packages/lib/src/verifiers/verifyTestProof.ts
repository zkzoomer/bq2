import { groth16 } from "snarkjs"
import { TestFullProof } from "../types"
import unpackProof from "../helpers/unpackProof"
import verificationKey from "../../snark-artifacts/testKey.json"

/**
 * Verifies a a proof of knowledge of a solution to a Block Qualified test.
 * @param fullProof The SnarkJS proof of knowledge.
 * @returns True if the proof is valid, false otherwise.
 */
export default function verifyTestProof(
    { publicSignals, proof }: TestFullProof,
): Promise<boolean> {
    return groth16.verify(
        verificationKey,
        publicSignals,
        unpackProof(proof)
    )
}
