# TestCredential Object

The [TestCredential](../../packages/lib/src/testCredential.ts) object abstracts most of the Block Qualified logic away, allowing you to easily interact with the protocol. It incorporates an [OpenZeppelin Autotask](https://docs.openzeppelin.com/defender/autotasks) for a [transaction relayer](https://docs.openzeppelin.com/defender/relay), making it easier to onboard users.

## Defining a TestCredential Object

You can define a new TestCredential object with the following syntax:
```js
const testCredential = await TestCredential.init(
    credentialId,
    {
        provider: "provider",
        apiKey: process.env.PROVIDER_KEY
    },
    "network",
    openAnswersHashes
)
```
{% hint style="warning" %}
The value for `openAnswersHashes` needs to be provided for tests that implement an open answers component, as defined for [Block Qualified tests](../technical-reference/block-qualified-tests.md)
{% endhint %}

{% hint style="info" %}
To see the officially supported networks, check out the [deployed contracts](../deployed-contracts.md)
{% endhint %}

## Grading a Solution to a Test
Once initialized, you can use the TestCredential object to grade solutions to the test:

```js
const result = testCredential.gradeSolution({ multipleChoiceAnswers, openAnswers })
```

Where `result` will be an object containing the following values:
- `grade`: over 100, grade obtained in the test.
- `minimumGrade`: over 100, minimum grade needed to pass the test.
- `pass`: whether the test was passed or not.
- `nQuestions`: number of open answer questions that make up this test.
- `multipleChoiceGrade`: grade obtained in the multiple choice component of this test.
- `openAnswerGrade`: grade obtained in the open answer component of this test.
- `multipleChoiceWeight`: percentage that the multiple choice component contributes towards the final grade.
- `openAnswerResults` array containing boolean values indicating the result for each open answer question.

## Generating and Verifying a Solution Proof

You can generate a test solution proof as described in [Block Qualified Proofs](../guides/proofs/README.md) by calling:

```js
const proof = await testCredential.generateSolutionProof(identity, { multipleChoiceAnswers, openAnswers })
```

Where the value for `identity` is a valid [Semaphore identity](http://semaphore.appliedzkp.org/docs/guides/identities) that is then added to a given group, as described in the [Block Qualified contracts](../technical-reference/contracts.md#solving-a-test).

{% hint style="info" %}
The TestCredential object takes care of generating additional proofs when the credential being solved is restricted.
{% endhint %}

You can then verify this proof by calling:

```js
const proofIsValid = await testCredential.verifySolutionProof(proof)
```

Which will return `true` or `false`.

## Sending a Solution Transaction

You can use the implemented [OpenZeppelin Relayer](https://docs.openzeppelin.com/defender/relay) to send this transaction free of gas.

```js
await testCredential.sendSolutionTransaction(proof)
```

{% hint style="info" %}
This helps in increasing privacy, since all solving transactions get sent from the same relayer address.
{% endhint %}

## Generating and Verifying a Rating Proof

You can generate a rating proof as described in [Rating the Credential Issuer](../guides/functionalities/credential-issuer-rating.md) by calling:

```js
const rateProof = await testCredential.generateRateIssuerProof(identity, rating, comment)
```

Where the value for `identity` is a valid [Semaphore identity](http://semaphore.appliedzkp.org/docs/guides/identities) that must have already gained this test credential.


You can then verify this proof by calling:

```js
const proofIsValid = await testCredential.verifyRateIssuerProof(rateProof)
```

Which will return `true` or `false`.

## Sending a Rating Transaction

You can use the implemented [OpenZeppelin Relayer](https://docs.openzeppelin.com/defender/relay) to send this transaction free of gas.

```js
await testCredential.sendRateIssuerTransaction(rateProof)
```

{% hint style="info" %}
This helps in increasing privacy, since all rating transactions get sent from the same relayer address.
{% endhint %}
