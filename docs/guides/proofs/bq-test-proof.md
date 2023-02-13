# Block Qualified Test Proof

In order to obtain a credential, the user must first provide a proof that shows they have necessary knowledge to obtain it. 

## Generating a Proof

You can use the `@bq-core/lib` library to generate such proofs, passing the following parameters to the `generateTestProof` function: 

- `identity`: the [Semaphore identity](https://semaphore.appliedzkp.org/docs/guides/identities) of the user generating the proof.
- `testAnswers`: composed of:
    - `multipleChoiceAnswers`: list containing the users' answers to the multiple choice component.
    - `openAnswers`: list containing the users' answers to the open answers component.
- `testVariables`: the parameters that define the test, these being the `minimumGrade`, `multipleChoiceWeight`, `nQuestions`, `multipleChoiceRoot`, `openAnswersHashesRoot`, and `openAnswersHashes`; as described in [Block Qualified Tests](../../technical-reference/block-qualified-tests.md).
- `identityGroup`: the group to which the user will be added, this logic being enforced by [the smart contract](../../technical-reference/contracts.md#solving-a-test):
    - If the grade obtained is above the specified `minimumGrade` for this test, this will be the credentials group.
    - Otherwise, `minimumGrade` must be set to `0` so that the proof does not revert, and this will be the no-credentials group.
- `gradeGroup`: the Semaphore-like group containing the [grade commitments](../../technical-reference/circuits.md#grade-tree-inclusion) of all users that attempted to obtain the credential.
- `snarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/test.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/test.wasm) trusted setup files.
- `testId`: the ID for this test, used to compute the value for the empty leaf when Merkle proofs are provided instead of groups.

## Verifying a Proof Off-Chain

You can use the `@bq-core/lib` library to verify a generated proof via the `verifyTestProof` function: 

```js
import { verifyTestProof } from "@bq-core/lib"

await verifyTestProof(testProof) // true or false.
```

Which returns a promise that resolves to true or false.