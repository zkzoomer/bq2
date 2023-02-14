# Block Qualified Test Proof

Once a user has obtained a credential, their grade commitment is added to the grade group. Similar to a [Semaphore inclusion proof](semaphore-inclusion-proof.md), they can signal anonymously with a zero-knowledge proof that proves that:
- they obtained a grade over a certain threshold, and
- the same user created the signal and the proof

## Generating a Proof

You can use the `@bq-core/lib` library to generate such proofs, passing the following parameters to the `generateGradeClaimProof` function: 
- `identity`: the [Semaphore identity](https://semaphore.appliedzkp.org/docs/guides/identities) of the user generating the proof.
- `gradeGroupOrMerkleProof`: the grade group to which the user belongs, or the corresponding Merkle proof.
- `gradeThreshold`: the value the user claims to have a higher grade than.
- `externalNullifier`: the value that prevents double-signaling.
- `signal`: the signal the user wants to send anonymously.
- `gradeCommitmentOrTestGradingVariables`: this variable can either be:
    - The `TestGradingVariables`, composed of the `multipleChoiceWeight` and the `nQuestions`. If this value is provided, the grade the user obtained is brute forced from their identity and grade group by testing all the possible grades they could have obtained.
    - The `FullGradeCommitment`, composed of the value of the grade commitment (`gradeCommitmentValue`) as specified for the [grade claim circuit](../../technical-reference/circuits.md#the-grade-claim-circuit), its index within the grade tree (`gradeCommitmentIndex`), as well as the `grade` and `weightedGrade` (its weighed value by `nQuestions`).
- `snarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/gradeClaim.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/gradeClaim.wasm) trusted setup files.

## Verifying a Proof Off-Chain

You can use the `@bq-core/lib` library to verify a generated proof via the `verifyGradeClaimProof` function: 

```js
import { verifyGradeClaimProof } from "@bq-core/lib"

await verifyGradeClaimProof(gradeClaimProof) // true or false.
```

Which returns a promise that resolves to true or false.
