# bq - Block Qualified

## Introduction 

Block Qualified allows users to gain credentials by solving tests *directly on-chain*: we use zero-knowledge proofs to ensure these solutions remain a secret, so cheating becomes mathematically unfeasible. Additionally, we integrate with the [Semaphore protocol](http://semaphore.appliedzkp.org/), which allows users to prove their membership of a group and send signals without revealing their original identity.

The end result is a protocol that allows users to:
- gain credentials by solving tests **without revealing their solutions**, and
-  make claims that they own these credentials **without revealing their identities**.

Block Qualified allows anyone to design their own open education platform, where users can:
- Earn credentials attesting to their knowledge.
- Anonymously prove ownership of their credentials.
- Anonymously prove that they obtained a grade above a certain threshold.
- Anonymously rate credential issuers.

All of this being done directly on-chain, with verifiable data, and preserving the privacy of users via zk-proofs.

## Tech Stack

The protocol is built on a comprehensive tech stack:
- The [circom circuits](./packages/circuits), which define the base logic of the protocol.
- The [core smart contracts](./packages/contracts/), developed in Solidity, and acting as verifiers to enforce this logic.
- A [subraph](https://github.com/0xdeenz/bq2-subgraph) used to index events from these smart contracts, and that can be interacted with via the separate [data package](./packages/data).
- A series of [TypeScript/JavaScript libraries](./packages/lib) are also provided, enabling developers to easily interact with the protocol and generate and verify all the proofs that power Block Qualified.

These have each been released as their separate npm packages, allowing developers to build on top of the protocol. More information on these can be found on each of the links above.

Additionally, a [simple frontend](https://github.com/0xdeenz/bq2-site) has been build on React, implementing a demo usecase of the protocol, and can be accessed at:
<div style="display:flex; align-items:center; justify-content:center; padding-bottom:15px">
    <a href="https://bq2.netlify.app/" target="_blank" aria_label="bq2-site">
        bq2.netlify.app
    </a>
</div>

## Technical Reference

At the core of Block Qualified is the [Credential Registry](./packages/contracts/contracts/CredentialsRegistry.sol), built to support **any kind of credential types**, each with their own behavior. A credential type defines how a  credential operates: the rules that must be followed to obtain them. Users can define the behavior of their own credential types, link them to the registry, and create and obtain different credentials that follow these set behaviors.

The [Credential Registry](./packages/contracts/contracts/CredentialsRegistry.sol) keeps track of all credential states, which are represented by Merkle trees:
- The **grade group**, composed of the [grade commitments](https://deenz.gitbook.io/bq2/technical-reference/circuits#grade-tree-inclusion) of all the users that attempted to gain the credential, regardless of whether they obtained it.
- The **credentials group**, composed of the [Semaphore identity commitments](http://semaphore.appliedzkp.org/docs/guides/identities) of all the users that obtained the credential.
- THe **no-credentials group**, composed of the [Semaphore identity commitments](http://semaphore.appliedzkp.org/docs/guides/identities) of all the users that did **not** obtain the credential.

Block Qualified has **native support for the [Test Credential](./packages/contracts/contracts/managers/TestCredentialManager.sol)**. Each test credential contains two distinct components, each forming a Merkle tree formed with the SNARK-friendly [Poseidon](https://www.poseidon-hash.info/) hash function:

<p align="center">
  <img src="https://raw.githubusercontent.com/0xdeenz/bq2/main/docs/technical-reference/test-diagram.png" width=100% />
</p>

- A **multiple choice component**, where the answer to each question is part of a given finite set. The grade for this component is only awarded if the user gets all the answers right.
- An **open answer component**, where the answer to each question can be any value. The leaves being the [_keccak256_ hashes](./packages/lib/src/helpers/hash.ts) of the answers, made compatible with the SNARK scalar modulus. The grade for this component is awarded incrementally per answer that the user gets right.

When the user's grade is over the defined `minimumGrade` ,they have gained the test credential, and their identity commitment gets added to the ***credentials group***. Otherwise, their identity commitment gets added to the ***no-credentials group***. This is all done inside of the zk-proof via the [Test circuit](./packages/circuits/circuits/test.circom) -- the [Test Credential](./packages/contracts/contracts/managers/TestCredentialManager.sol) smart contract then enforces the correctness of the proof.

After users have attempted a credential, they can:
- Use the [Semaphore circuit](http://semaphore.appliedzkp.org/docs/technical-reference/circuits) to signal anonymously with a zero-knowledge proof that they are a part of the credentials/no-credentials group.
- Use the [Grade Claim circuit](./packages/circuits/circuits/grade_claim.circom) to signal anonymously with a zero-knowledge proof that they obtained a grade that is greater than or equal to a certain threshold.

Users earn these credentials by sending transactions to the [Credential Registry](./packages/contracts/contracts/CredentialsRegistry.sol). In order to increase privacy, and since these transactions do not require a direct interaction from the user (like when managing funds), a **transaction relayer** is used. This way, all transactions originate from the same address, so tracing them back to a user becomes a harder task. The [Defender Relay](https://docs.openzeppelin.com/defender/relay) service by OpenZeppelin is used to this end.

#### You can read more about the technical implementation on the [documentation](https://deenz.gitbook.io/bq2/technical-reference/block-qualified-tests).

## Additional Resources

#### You can check this 3-minute [demo walkthrough](https://youtu.be/n0m2aHLhoXs) highlighting the main functionalities.

This demo has been deployed on the Polygon Mumbai testnet network. If you wish to interact directly with the protocol, you can get yourself some testnet funds at [this faucet](https://mumbaifaucet.com/) or [this faucet](https://faucet.polygon.technology/).

#### Deployed Contracts

| Contract | Mumbai |
| -------- | ------ |
| [CredentialsRegistry.sol](../packages/contracts/contracts/CredentialsRegistry.sol) | [0x5A14...14C4](https://mumbai.polygonscan.com/address/0x5A140303E92da80BF96a734fd777957fF02714C4) |
| [TestCredentialManager.sol](../packages/contracts/contracts/managers/TestCredentialManager.sol) | [0x043c...1cee](https://mumbai.polygonscan.com/address/0x043c69abf15d154cf0Ffc482f8d63eE7874e1cee) |
| [LegacyCredentialManager.sol](../packages/contracts/contracts/managers/LegacyCredentialManager.sol) | [0x7747...72C7](https://mumbai.polygonscan.com/address/0x77479918eA3962f8a1EfCc578520582778E272C7) |
| [GradeClaimVerifier.sol](../packages/contracts/contracts/base/GradeClaimVerifier.sol) | [0x987B...4eb1](https://mumbai.polygonscan.com/address/0x987B9432B78f1A26490f88D8F972c0a2c46C4eb1) |
| [TestVerifier.sol](../packages/contracts/contracts/managers/verifiers/TestVerifier.sol) | [0xA868...f610](https://mumbai.polygonscan.com/address/0xA8687a68c919aB5bAcB039Dd656dA8b2c4DEf610) |
| [PoseidonT4.sol](../packages/contracts/contracts/libs/Poseidon.sol) | [0xc5031...Aa62](https://mumbai.polygonscan.com/address/0xc50311C8811B9a19f41EB4B121E3023966BAAa62) |

#### Inherited Contracts

| Contract | Mumbai |
| -------- | ------ |
| [SemaphoreVerifier.sol](https://github.com/semaphore-protocol/semaphore/blob/main/packages/contracts/contracts/base/SemaphoreVerifier.sol) | [0x5f4e...5a49](https://mumbai.polygonscan.com/address/0x5f4edC58142f4395D1D536e793137A0252dA5a49) |
| [PoseidonT3.sol](../packages/contracts/contracts/libs/Poseidon.sol) | [0x181B...1648](https://mumbai.polygonscan.com/address/0x181B7f34538cE3BceC68597d4A212aB3f7881648) |

