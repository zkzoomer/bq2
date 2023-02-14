## What is Block Qualified?

### Overview

Block Qualified aims to become an open education platform where users can create their own learning experience. Anyone can gain credentials that attest to their knowledge, or verify the qualifications of others. All of this being done directly on-chain, with verifiable data, and preserving the privacy of users via zero-knowledge proofs.

### Features

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

The base logic of the protocol is reflected in the [circuits](../packages/circuits/), which interact with the core [smart contracts](../packages/contracts/). A series of [JavaScript libraries](../packages/lib/) are also provided, enabling developers to easily generate and verify all the proofs that power Block Qualified.