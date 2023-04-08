# LegacyCredential Object

The [LegacyCredential](../../packages/lib/src/LegacyCredential.ts) object allows users to easily manage their legacy credentials off-chain, and send updates on-chain when they see necessary.

## Defining a LegacyCredential Object

Users can either use this library to create a new legacy credential on-chain, or connect to an existing one.

### Creating a New Legacy Credential

You can create a new legacy credential with the following syntax:

```js
const legacyCredential = await LegacyCredential.new(
    credentialId,
    treeDepth,
    merkleTreeDuration,
    credentialURI,
    minimumGrade,
    legacyCredentialRecipients, 
    signer,
    {
        provider: "provider",
        apiKey: process.env.PROVIDER_KEY
    },
    "network"
)
```

Where the `legacyCredentialRecipients` is a list of objects which contains information about the credential recipients in the form of:
```ts
type LegacyCredentialRecipient = {
    userSecret: string
    grade: number
}
```
With the user secret being a value thatis only known by the user and the credential issuer. Credential issuers will then have the ability to change user's identity commitments via [setting a new user identity](#setting-a-new-user-identity)

{% hint style="info" %}
To see the officially supported networks, check out the [deployed contracts](../deployed-contracts.md)
{% endhint %}

### Loading an Existing Legacy Credential

You can create a new legacy credential with the following syntax:

```js
const legacyCredential = await LegacyCredential.load(
    credentialId,
    gradeGroup,
    credentialsGroup,
    noCredentialsGroup,
    signer,
    {
        provider: "provider",
        apiKey: process.env.PROVIDER_KEY
    },
    "network"
)
```

Where the groups being provided must match the roots that were stored on-chain, and the signer provided must match the on-chain admin.

## Setting a New User Identity

Once added into groups, legacy credential issuers can give users the ability to define their own [Semaphore identities](http://semaphore.appliedzkp.org/docs/guides/identities) that are only known by them. This is done via:

```js
legacyCredential.setNewUserIdentity(
    legacyCredentialRecipient,
    newIdentity
)
```

## Adding a Recipient

Legacy credential issuers can still add more recipients by calling:

```js
legacyCredential.addCredentialRecipient(
    legacyCredentialRecipient
)
```

## Publishing Changes On-Chain

After managing the legacy credential groups on-chain, credential issuers can then update the on-chain state by calling:

```js
await legacyCredential.publishChanges()
```
