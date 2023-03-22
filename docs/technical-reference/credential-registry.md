# The Credential Registry

The Credential Registry functions as the core contract for Block Qualified, as it manages the creation, updating, data fetching, and invalidating of credentials. The Credential Registry also serves to verify credential ownership and grade claim proofs, allowing other smart contracts to build on top of and integrate Block Qualified into their project.

The Credential Registry keeps track of all credential states, which are the Merkle roots and number of non-empty leaves for each of the groups that define a credential:
- The **grade group**, composed of the [grade commitments](./circuits.md#grade-tree-inclusion) of all the users that attempted to gain the credential, regardless of whether they obtained it.
- The **credentials group**, composed of the [Semaphore identity commitments](http://semaphore.appliedzkp.org/docs/guides/identities) of all the users that obtained the credential.
- THe **no-credentials group**, composed of the [Semaphore identity commitments](http://semaphore.appliedzkp.org/docs/guides/identities) of all the users that did **not** obtain the credential.

### Creating a New Credential

Anyone can create a new Block Qualified Credential by calling the `createCredential` function inside the smart contract and providing:
- `treeDepth`: depth of the trees that define the credential state.
- `credentialType`: unique identifier that links to the credential manager that will define its behavior.
- `merkleTreeDuration`: maximum time that an expired Merkle root can still be used to generate proofs of membership (credential ownership and grade claim) for this credential.
- `credentialData`: encoded data bytes that defines the credential, as per the credential manager specifications.
- `credentialURI`: external resource containing more information about the credential

Credential types are stored inside a mapping and need to be defined before creating a test. Each credential type links to a [Credential Manager](./credential-managers.md), which implements its own logic and will receive the `credentialData` to initialize the credential within its own contract.

The resulting credential is given a unique `credentialId` that will serve to identify it. 

{% hint style="warning" %}
The Credential Registry does not define the owner or admin of a credential. This is an optional feature that if desired must be implemented by the [Credential Manager](./credential-managers.md).

The natively supported [Test Credential](./test-credential-manager.md) does implement such feature.
{% endhint %}

The function then defines three new on-chain groups:

- The **grade Semaphore-like group**, that will contain all the grade commitments for every solving attempt, and whose `groupId = 3 ⋅ credentialId`.
- The **credentials Semaphore group**, that will contain all the identity commitments of the users that obtain the credential, and whose `groupId = 3 ⋅ credentialId + 1`.
- The **no-credentials Semaphore group**, that will contain all the identity commitments of the users that do not obtain the credential, and whose `groupId = 3 ⋅ credentialId + 2`.

{% hint style="warning" %}
Although these three groups are all given different `groupId`s, they are all constructed using the same `zeroLeaf` for gas saving purposes:

$$
    \texttt{zeroLeaf} = \textrm{keccak256}(\texttt{credentialId}) >> 8
$$
{% endhint %}

### Defining a New Credential Type

Users can define the behavior of their own credential types by first deploying their [ICredentialManager](../../packages/contracts/contracts/interfaces/ICredentialManager.sol) compliant [Credential Manager](./credential-managers.md), and later linking them to the registry by calling the function `defineCredentialType` and providing:
- `credentialType`: unique identifier of the new credential type.
- `credentialManager`: [ICredentialManager](../../packages/contracts/contracts/interfaces/ICredentialManager.sol) compliant smart contract address.

Credentials created under this `credentialType` will follow the behaviors set by this [Credential Manager](./credential-managers.md).

### Updating a Credential

Users can update the state of a credential by calling the function `updateCredential` and providing:
- `credentialId`: unique identifier of the credential to be updated.
- `credentialUpdate`: encoded data bytes that defines the credential update, as per the credential manager specifications.

The Credentials Registry simply keeps track of the state of credentials, and thus implements no logic to update their state. What it does is call the corresponding [Credential Manager](./credential-managers.md) to update the credential, while also passing it the current credential state.

### Invalidating a Credential
Users can update the state of a credential by calling the function `invalidateCredential` and providing:
- `credentialId`: unique identifier of the credential to be invalidated.

The Credentials Registry simply keeps track of the state of credentials, and thus implements no logic to invalidate them. What it does is call the corresponding [Credential Manager](./credential-managers.md) to invalidate the credential.

### Rating a Credential 
After generating a valid Semaphore proof that provides a [rating](../guides/functionalities/credential-issuer-rating.md) for the credential issuer, users can publish these directly on-chain by calling the `rateCredential` function and providing:
- `credentialId`: unique identifier of the credential that is being rated.
- `credentialsTreeRoot`: root of the credentials Merkle tree.
- `nullifierHash`: nullifier hash to be voided.
- `proof`: [Semaphore zero-knowledge proof](https://semaphore.appliedzkp.org/docs/guides/proofs).
- `rating`: rating given to the credential issuer for this test, 0-100.
- `comment`: a comment given to the credential issuer.

After verifying the proof, the `rating` is recorded on-chain. The average rating for a credential can be accessed by calling `getCredentialAverageRating` and specifying the `credentialId`. 

{% hint style="info" %}
The external nullifier being used to prevent double-signaling is the string `bq-rate`.
{% endhint %}

### Verifying a Credential Ownership Proof
External contracts can verify credential ownership proofs by calling the `verifyCredentialOwnershipProof` function and providing:
- `credentialId`: unique identifier of the credential for which an ownership proof is being verified.
- `merkleTreeRoot`: root of the credentials Merkle tree.
- `nullifierHash`: nullifier hash to be voided.
- `signal`: Semaphore signal.
- `externalNullifier`: external nullifier.
- `proof`: [Semaphore zero-knowledge proof](https://semaphore.appliedzkp.org/docs/guides/proofs).

{% hint style="info" %}
Note that this is an **external** function, which costs gas to execute and **voids the nullifier hash** in the process - the same proof cannot be verified twice.
{% endhint %}

### Verifying a Grade Claim Proof
External contracts can verify grade claim proofs by calling the `verifyGradeClaimProof` function and providing:
- `credentialId`: unique identifier of the credential for which an ownership proof is being verified.
- `gradeTreeRoot`: root of the grade Merkle tree.
- `nullifierHash`: nullifier hash to be voided.
- `gradeThreshold`: grade threshold the user claims to have obtained.
- `signal`: Semaphore signal.
- `externalNullifier`: external nullifier.
- `proof`: [grade claim zero-knowledge proof](./circuits.md#the-grade-claim-circuit).

{% hint style="info" %}
Note that this is an **external** function, which costs gas to execute and **voids the nullifier hash** in the process - the same proof cannot be verified twice.
{% endhint %}