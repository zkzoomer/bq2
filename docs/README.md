## What is Block Qualified?

### Overview

Block Qualified aims to become an open education platform where users can create their own learning experience. Anyone can create and gain credentials that attest to their knowledge, or verify the qualifications of others. All of this being done directly on-chain, with verifiable data, and preserving the privacy of users via zero-knowledge proofs.

### Features

At the core of Block Qualified is the [Credential Registry](./technical-reference/credential-managers.md), built to support different kinds of credential types, each with their own behavior. A credential type defines how a certain credential operates: the rules that must be followed to obtain them. Users can define the behavior of their own credential types, link them to the registry, and create and obtain different credentials that follow these set behaviors.

Block Qualified has native support for the [Test Credential](./technical-reference/test-credential-manager.md). Each test credential has a multiple choice question component and an open answer component, with a minimum grade needed to obtain it. Users can gain these credentials by providing proofs of knowledge of their solution. The actual solutions are encoded as part of the proof and thus are kept private, preventing other users from cheating by looking at public on-chain data.

Users can define their own on-chain credentials, evaluation some kind of knowledge, and link them to the credential registry.

Users can define their own on-chain exams where they evaluate some kind of knowledge. Anyone can come in an attempt to solve this test: if they do so, they prove that they have the necessary knowledge.

By leveraging [Semaphore](http://semaphore.appliedzkp.org/) we add an additional privacy layer when proving ownership of credentials.

Block Qualified allows you to design your own open education platform where users can:
- Earn credentials attesting to their knowledge.
- Prove ownership of their credentials without revealing anything else about themselves.
- Prove that the grade they obtained on a given credential is above a certain threshold.
- Rate credential issuers anonymously, restricting these ratings to users that have obtained their credentials.
- Build Semaphore groups for users holding certain credentials so that they may communicate with each other.
- Onboard legacy credential issuers into your platform.

### About the Code

The base logic of the protocol is reflected in the [circuits](./technical-reference/circuits.md), which interact with the core [smart contracts](./technical-reference/contracts.md). A series of [JavaScript libraries](./guides/proofs/README.md) are also provided, enabling developers to easily generate and verify all the proofs that power Block Qualified.