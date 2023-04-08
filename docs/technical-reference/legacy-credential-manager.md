# The Test Credential Manager
Block Qualified implements native support for the Legacy Credential, which operates as a [Credential Manager](./credential-managers.md) under the [Credentials Registry](./credential-registry.md). Legacy Credentials are designed to be managed off-chain, allowing the credential issuer to keep track of these changes by updating the on-chain state.

### Creating a Legacy Credential
To create a Legacy Credential, the `createCredential` function of the [Credential Registry](./credential-registry.md) is called, providing:
- `credentialId`: unique identifier of the legacy credential to be created.
- `treeDepth`: tree depth of the different groups that will be created -- must be set to 16.
- `credentialType`: the credential manager type that enforces the test credential logic -- by default it is 1.
- `merkleTreeDuration`: maximum time that an expired Merkle root can still be used to generate proofs of membership for this credential.
- `credentialData`: encoded data bytes that will define the legacy credential.
- `credentialURI`: external resource containing more information about the credential.

The encoded data bytes `credentialData` for the Legacy Credential can be generated using the library function [`encodeLegacyCredential`](../../packages/lib/src/helpers/encodeInputs.ts), and providing:
- `gradeTreeIndex`: the number of members that make up the grade tree.
- `credentialsTreeIndex`: the number of members that make up the credentials tree.
- `noCredentialsTreeIndex`: the number of members that make up the no-credentials tree.
- `gradeTreeRoot`: Merkle roof of the grade tree.
- `credentialsTreeRoot`: Merkle roof of the credentials tree.
- `noCredentialsTreeRoot`: Merkle roof of the no-credentials tree.
- `minimumGrade`: minimum total grade the user must get to obtain the credential.

{% hint style="warning" %}
This function cannot be called directly, as it only supports calls made from the [Credential Registry](./credential-registry.md).
{% endhint %}

The [Credential Registry](./credential-registry.md) will finish initializing this credential by defining the corresponding groups: grade, credentials, and no-credentials.

### Updating a Legacy Credential
To update a Legacy Credential, the `updateCredential` function of the [Credential Registry](./credential-registry.md) is called, providing:
- `credentialId`: unique identifier of the legacy credential to be updated.
- `credentialUpdate`: encoded data bytes that defines the credential update.

{% hint style="warning" %}
This function cannot be called directly, as it only supports calls made from the [Credential Registry](./credential-registry.md).
{% endhint %}

The encoded data bytes `credentialUpdate` can be generated using the library function [`encodeLegacyCredential`](../../packages/lib/src/helpers/encodeInputs.ts), and providing the same values minus the `minimumGrade`.

{% hint style="info" %}
The smart contract does not enforce any logic that these state transitions are valid. Instead, we assume that the legacy credential issuer will be the one to maintain the correct state of the different groups. To this end, we provide users with the [LegacyCredential](../guides/legacy-credential.md) library.
{% endhint %}
