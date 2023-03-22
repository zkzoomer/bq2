# Credential Managers

Users can define the behavior of their own credential types by first deploying their [ICredentialManager](../../packages/contracts/contracts/interfaces/ICredentialManager.sol) compliant Credential Manager. Credential Managers govern the behavior of credentials.

### Creating a Credential
To create a credential to be governed by a certain Credential Manager, the `createCredential` function is called, providing:
- `credentialId`: unique identifier of the credential to be created.
- `credentialData`: encoded data bytes that will define the credential, as per the credential manager specifications.

{% hint style="warning" %}
Although not mandatory, it is recommended that Credential Managers restrict the calling of this function to the [Credential Registry](./credential-registry.md) only.

However, users may still choose to implement a different behavior.
{% endhint %}

### Updating a Credential
To update a credential governed by a certain Credential Manager, the `updateCredential` function is called, providing:
- `credentialId`: unique identifier of the credential to be updated.
- `credentialState`: current state of the credential, as stored inside the [Credentials Registry](./credential-registry.md).
- `credentialUpdate`: encoded data bytes that defines the credential update, as per the credential manager specifications.

This function will return the credential's new state, which is later used to update the state that the [Credential Registry](./credential-registry.md) stored for this credential.

{% hint style="warning" %}
Although not mandatory, it is recommended that Credential Managers restrict the calling of this function to the [Credential Registry](./credential-registry.md) only.

However, users may still choose to implement a different behavior.
{% endhint %}

### Invalidating a Credential
To invalidate a credential governed by a certain Credential Manager, the `invalidateCredential` function is called, providing:
- `credentialId`: unique identifier of the credential to be invalidated.

{% hint style="warning" %}
Although not mandatory, it is recommended that Credential Managers restrict the calling of this function to the [Credential Registry](./credential-registry.md) only.

After being invalidated, credentials should no longer be obtainable, and their state on-chain should remain fixed.

However, users may still choose to implement a different behavior.
{% endhint %}