# Block Qualified Restricted Test Proof

Besides the necessary proof of knowledge, some test credentials require users first prove they meet certain requirements. These requirements can be:
- [**Credential restricted tests**](#credential-restricted-tests): the user must prove they have a different credential.
- [**Grade Restricted tests**](#grade-restricted-tests): the user must prove they obtained a grade over a threshold for a different credential.

## Credential Restricted Tests
Users must prove, alongside their usual [test proof](./bq-test-proof.md), a [Semaphore proof](https://semaphore.appliedzkp.org/docs/guides/proofs) that verifies that they own the required credential.

### Generating a Proof
You can use the `@bq-core/lib` library to generate such proofs, passing the following parameters to the `generateCredentialRestrictedTestProof` function: 
- `identity`: the [Semaphore identity](https://semaphore.appliedzkp.org/docs/guides/identities) of the user generating the proof.
- `testAnswers`: composed of:
    - `multipleChoiceAnswers`: list containing the user's answers to the multiple choice component.
    - `openAnswers`: list containing the user's answers to the open answers component.
- `testVariables`: the parameters that define the test, these being the `minimumGrade`, `multipleChoiceWeight`, `nQuestions`, `multipleChoiceRoot`, `openAnswersHashesRoot`, and `openAnswersHashes`; as described in [Block Qualified Tests](../../technical-reference/block-qualified-tests.md).
- `testIdentityGroup`: the group to which the user will be added, this logic being enforced by [the smart contract](../../technical-reference/contracts.md#solving-a-test):
    - If the grade obtained is above the specified `minimumGrade` for this test, this will be the credentials group.
    - Otherwise, `minimumGrade` must be set to `0` so that the proof does not revert, and this will be the no-credentials group.
- `gradeGroup`: the Semaphore-like group containing the [grade commitments](../../technical-reference/circuits.md#grade-tree-inclusion) of all users that attempted to obtain the credential.
- `requiredCredentialsGroup`: the Semaphore group corresponding to the require credential, where the user was already added.
- `testSnarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/test.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/test.wasm) trusted setup files for the test circuit.
- `semaphoreSnarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/semaphore.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/semaphore.wasm) trusted setup files for the Semaphore circuit, taken from [PSE SNARK artifacts](https://www.trusted-setup-pse.org/).
- `testId`: the ID for this test, used to compute the value for the empty leaf when Merkle proofs are provided instead of groups.

Which returns a promise that resolves to the `credentialRestrictedTestFullProof`: containing the proof of knowledge for the test, `testFullProof`, and the Semaphore proof of inclusion `semaphoreFullProof`.

{% hint style="warning" %}
When providing a group to this function, an empty leaf is added in order to generate the corresponding Merkle proofs. 

If the proof is later accepted by the smart contract and the corresponding on-chain groups get updated, developers should use the [`updateMember`](https://github.com/semaphore-protocol/semaphore/blob/main/packages/group/src/group.ts#L86) function to update their off-chain groups. Using the [`addMember`](https://github.com/semaphore-protocol/semaphore/blob/main/packages/group/src/group.ts#L67) function instead would create a new leaf _after_ the empty leaf that was added before.
{% endhint %}

### Verifying a Proof Off-Chain

You can use the `@bq-core/lib` library to verify the generated test proof via the `verifyTestProof` function: 

```js
import { verifyTestProof } from "@bq-core/lib"

await verifyTestProof(restrictedCredentialProof.testFullProof) // true or false.
```

Which returns a promise that resolves to true or false.

And use the `@semaphore-protocol/proof` library to verify the generated Semaphore proof via the `verifyProof` function:

```js
import { verifyProof } from "@semaphore-protocol/proof"

await verifyProof(restrictedCredentialProof.semaphoreFullProof) // true or false.
```

Which returns a promise that resolves to true or false.

## Grade Restricted Tests
Users must prove, alongside their usual [test proof](./bq-test-proof.md), a [grade claim](./grade-claim-proof.md) that verifies that they obtained a grade above a certain threshold for the required credential.

### Generating a Proof
You can use the `@bq-core/lib` library to generate such proofs, passing the following parameters to the `generateGradeRestrictedTestProof` function: 
- `identity`: the [Semaphore identity](https://semaphore.appliedzkp.org/docs/guides/identities) of the user generating the proof.
- `testAnswers`: composed of:
    - `multipleChoiceAnswers`: list containing the user's answers to the multiple choice component.
    - `openAnswers`: list containing the user's answers to the open answers component.
- `testVariables`: the parameters that define the test, these being the `minimumGrade`, `multipleChoiceWeight`, `nQuestions`, `multipleChoiceRoot`, `openAnswersHashesRoot`, and `openAnswersHashes`; as described in [Block Qualified Tests](../../technical-reference/block-qualified-tests.md).
- `testIdentityGroup`: the group to which the user will be added, this logic being enforced by [the smart contract](../../technical-reference/contracts.md#solving-a-test):
    - If the grade obtained is above the specified `minimumGrade` for this test, this will be the credentials group.
    - Otherwise, `minimumGrade` must be set to `0` so that the proof does not revert, and this will be the no-credentials group.
- `testGradeGroup`: the Semaphore-like group containing the [grade commitments](../../technical-reference/circuits.md#grade-tree-inclusion) of all users that attempted to obtain the credential.
- `gradeClaimGroupOrMerkleProof`: the grade group to which the user belongs and the credential is restricted to, or the corresponding Merkle proof.
- `gradeClaimThreshold`: the value the user claims to have a higher grade than.
- `gradeClaimCommitmentOrTestGradingVariables`: this variable can either be:
    - The `TestGradingVariables`, composed of the `multipleChoiceWeight` and the `nQuestions`. If this value is provided, the grade the user obtained is brute forced from their identity and grade group by testing all the possible grades they could have obtained.
    - The `FullGradeCommitment`, composed of the value of the grade commitment (`gradeCommitmentValue`) as specified for the [grade claim circuit](../../technical-reference/circuits.md#the-grade-claim-circuit), its index within the grade tree (`gradeCommitmentIndex`), and the `grade` obtained.
- `requiredCredentialsGroup`: the Semaphore group corresponding to the require credential, where the user was already added.
- `testSnarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/test.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/test.wasm) trusted setup files for the test circuit.
- `gradeClaimSnarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/gradeClaim.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/gradeClaim.wasm) trusted setup files for the grade claim circuit.
- `testId`: the ID for this test, used to compute the value for the empty leaf when Merkle proofs are provided instead of groups.

Which returns a promise that resolves to the `gradeRestrictedTestFullProof`: containing the proof of knowledge for the test, `testFullProof`, and the grade claim proof `gradeClaimFullProof`.

{% hint style="warning" %}
When providing a group to this function, an empty leaf is added in order to generate the corresponding Merkle proofs. 

If the proof is later accepted by the smart contract and the corresponding on-chain groups get updated, developers should use the [`updateMember`](https://github.com/semaphore-protocol/semaphore/blob/main/packages/group/src/group.ts#L86) function to update their off-chain groups. Using the [`addMember`](https://github.com/semaphore-protocol/semaphore/blob/main/packages/group/src/group.ts#L67) function instead would create a new leaf _after_ the empty leaf that was added before.
{% endhint %}

### Verifying a Proof Off-Chain

You can use the `@bq-core/lib` library to verify the generated test proof via the `verifyTestProof` function: 

```js
import { verifyTestProof } from "@bq-core/lib"

await verifyTestProof(gradeRestrictedTestFullProof.testFullProof) // true or false.
```

Which returns a promise that resolves to true or false.

And use the `verifyGradeClaimProof` function to verify the generated grade claim proof: 

```js
import { verifyGradeClaimProof } from "@bq-core/lib"

await verifyGradeClaimProof(gradeRestrictedTestFullProof.gradeClaimFullProof) // true or false.
```

Which returns a promise that resolves to true or false.
