import { Proof, SnarkJSProof } from "../types";

export function packProof(originalProof: SnarkJSProof): Proof {
    return [
        originalProof.pi_a[0],
        originalProof.pi_a[1],
        originalProof.pi_b[0][1],
        originalProof.pi_b[0][0],
        originalProof.pi_b[1][1],
        originalProof.pi_b[1][0],
        originalProof.pi_c[0],
        originalProof.pi_c[1]
    ]
}
