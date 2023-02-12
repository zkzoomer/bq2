# Block Qualified Test Proof

Once a user has added their identity commitment to either the credentials or no-credentials group, they can use [Semaphore proofs](https://semaphore.appliedzkp.org/docs/guides/proofs) to signal anonymously with a zero-knowledge proof that proves that:
- they are part of the credentials/no-credentials group, and
- the same user created the signal and the proof

## Generating a proof

Similar to a Semaphore proof, you can use the `@bq-core/lib` library to generate such proofs, passing the following parameters to the `generateCredentialOwnershipProof` function: 

- `identity`: the Semaphore identity of the user broadcasting the signal and generating the proof.
- `groupOrMerkleProof`: the group to which the user belongs, either the credentials or no-credentials group, or the corresponding Merkle proof.
- `externalNullifier`: the value that prevents double-signaling.
- `signal`: the signal the user wants to send anonymously.
- `snarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/semaphore.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/semaphore.wasm) trusted setup files, taken from [PSE SNARK artifacts](https://www.trusted-setup-pse.org/)
## Verifying a Proof Off-Chain

You can use the `@bq-core/lib` library to verify a generated proof via the `verifyCredentialOwnershipProof` function: 

```js
import { verifyCredentialOwnershipProof } from "@bq-core/lib"

await verifyCredentialOwnershipProof(testProof) // true or false.
```

Which returns a promise that resolves to true or false.