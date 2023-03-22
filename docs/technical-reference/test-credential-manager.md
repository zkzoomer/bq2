# The Test Credential Manager
Block Qualified implements native support for the Test Credential, which operates as a [Credential Manager](./credential-managers.md) under the [Credentials Registry](./credential-registry.md). Each Test Credential has a multiple choice question component and an open answer component, with a minimum grade needed to obtain it. Users can gain these credentials by providing proofs of knowledge of their solution. The actual solutions are encoded as part of the proof and thus are kept private, preventing other users from cheating by looking at public on-chain data.

### Creating a Test Credential
To create a Test Credential, the `createCredential` function of the [Credential Registry](./credential-registry.md) is called, providing:
- `credentialId`: unique identifier of the test credential to be created.
- `credentialData`: encoded data bytes that will define the test credential.

{% hint style="warning" %}
This function cannot be called directly, as it only supports calls made from the [Credential Registry](./credential-registry.md).
{% endhint %}

The encoded data bytes `credentialData` for the Test Credential can be generated using the library function [`encodeTestInitializingParameters`](../../packages/lib/src/helpers/encodeInputs.ts), and providing:
- `minimumGrade`: out of 100, minimum total grade the user must get to obtain the credential.
- `multipleChoiceWeight`: out of 100, contribution of the multiple choice component towards the total grade: 100 for pure multiple choice tests, 0 for pure open answer tests.
- `nQuestions`: number of open answer questions the test has -- must be set to 1 for pure multiple choice tests.
- `timeLimit`: unix time limit after which it is not possible to obtain this credential -- must be set to 0 for unlimited.
- `admin`: address that controls this credential.
- `requiredCredential`: the `credentialId` of the credential that needs to be obtained before this one -- set 0 for unrestricted. If set, a [Semaphore credential ownership proof](https://semaphore.appliedzkp.org/docs/guides/proofs) will have to be provided alongside the [test proof](./circuits.md#the-test-circuit).
- `requiredCredentialGradeThreshold`: minimum grade that must be obtained for the required credential -- set 0 for unrestricted. If set, a [grade claim proof](./circuits.md#the-grade-claim-circuit) will have to be provided alongside the [test proof](./circuits.md#the-test-circuit).
- `multipleChoiceRoot`: root of the multiple choice Merkle tree, where each leaf is the correct choice out of the given ones, as specified in the [test object](./block-qualified-tests.md).
- `openAnswersHashesRoot`: root of the open answers Merkle tree, where each leaf is the hash of the corresponding correct answer, as specified in the [test object](./block-qualified-tests.md).

The [Credential Registry](./credential-registry.md) will finish initializing this credential by defining the corresponding groups: grade, credentials, and no-credentials.

### Updating a Test Credential
To update a Test Credential, the `updateCredential` function of the [Credential Registry](./credential-registry.md) is called, providing:
- `credentialId`: unique identifier of the test credential to be updated.
- `credentialUpdate`: encoded data bytes that defines the credential update.

{% hint style="warning" %}
This function cannot be called directly, as it only supports calls made from the [Credential Registry](./credential-registry.md).
{% endhint %}

The encoded data bytes `credentialUpdate` will contain a valid proof for the [Test circuit](circuits.md#the-test-circuit) that verifies their proof of knowledge of their solution. Users can generate these proofs via the library, as described in [Block Qualified test proof](../guides/proofs/bq-test-proof.md).

To obtain restricted test credentials, users will also have to include a proof that they meets the imposed requirements.

#### Unrestricted Tests
The encoded data bytes `credentialUpdate` for unrestricted tests can be generated using the library function [`encodeTestFullProof`](../../packages/lib/src/helpers/encodeInputs.ts), and providing:
- `testFullProof`: the proof generated for the [Block Qualified test](../guides/proofs/bq-test-proof.md).
- `testPassed`: a boolean parameter indicating if their solution achieves a grade over the `minimumGrade` or not

{% hint style="info" %}
Verifying that users cannot cheat by claiming that they passed a test when they did not is enforced is by setting the `testParameters` public signal of the proof: 
- If the user sets `testPassed` to **true**, the public input `testParameters` set when verifying the proof will make it **invalid** if the grade obtained is below `minimumGrade`.
- If the user sets `testPassed` to **false**, the public input `testParamters` will set the `minimumGrade` to 0, so the grade check inside the proof will clear.
{% endhint %}

{% hint style="warning" %}
This means that a user can potentially provide a passing solution and still decide to add themselves to the no-credentials group.
{% endhint %}

Depending on the value for `testPassed`, the user will get their Semaphore identity commitment added to the credentials group or to the no-credentials group, respectively. Their grade commitment will be added to the grade group either way. These groups are managed by the [Credentials Registry](./credential-registry.md).

#### Credential Restricted Tests
Users must provide aan additional [Semaphore proof](https://semaphore.appliedzkp.org/docs/guides/proofs) that verifies that they own the `requiredCredential`. Users can generate these proofs via the library, as described in [grade restricted tests](../guides/proofs/bq-restricted-test-proof.md#credential-restricted-tests).

{% hint style="info" %}
The external nullifier being used to prevent double-signaling is the string `bq-credential-restricted-test`.
{% endhint %}

The encoded data bytes `credentialUpdate` for credentail restricted tests can be generated using the library function [`encodeCredentialRestrictedTestFullProof`](../../packages/lib/src/helpers/encodeInputs.ts), and providing:
- `credentialRestrictedTestFullProof`: the [credential restricted test proof](../guides/proofs/bq-restricted-test-proof.md#credential-restricted-tests) generated with the library.
- `testPassed`: a boolean parameter indicating if their solution achieves a grade over the `minimumGrade` or not.

#### Grade Restricted Tests
Users must provide aan additional [grade claim proof](circuits.md#the-grade-claim-circuit) that verifies that they obtained over a grade over a certain threshold for the `requiredCredential`. Users can generate these proofs via the library, as described in [grade restricted tests](../guides/proofs/bq-restricted-test-proof.md#grade-restricted-tests).

{% hint style="info" %}
The external nullifier being used to prevent double-signaling is the string `bq-grade-restricted-test`.
{% endhint %}

The encoded data bytes `credentialUpdate` for grade restricted tests can be generated using the library function [`encodeGradeRestrictedTestFullProof`](../../packages/lib/src/helpers/encodeInputs.ts), and providing:
- `gradeRestrictedTestFullProof`: the [grade restricted test proof](../guides/proofs/bq-restricted-test-proof.md#grade-restricted-tests) generated with the library.
- `testPassed`: a boolean parameter indicating if their solution achieves a grade over the `minimumGrade` or not.

### Verifying a Test Credential
The admin of a test credential can choose to _verify it_ by providing the open answer hashes needed to solve this test directly on-chain, which is done by calling the function `verifyTestCredentialAnswers`.
