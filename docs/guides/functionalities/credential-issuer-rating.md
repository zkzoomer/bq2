# Rating the Credential Issuer

After a user has obtained a credential, they can anonymously rate the credential issuer via a [Semaphore proof](https://semaphore.appliedzkp.org/docs/guides/proofs). This can be done by calling the `generateRateCredentialIssuerProof` function inside the `@bq-core/lib` library with the following parameters:

- `identity`: the Semaphore identity of the user broadcasting the signal and generating the proof.
- `groupOrMerkleProof`: the group to which the user belongs, which must be the credentials group in order to rate the credential issuer.
- `rate`: from 0 to 100, the rating the user gives to the credential issuer.
- `snarkArtifacts`: the [`zkey`](../../../packages/lib/snark-artifacts/semaphore.zkey) and [`wasm`](../../../packages/lib/snark-artifacts/semaphore.wasm) trusted setup files, taken from [PSE SNARK artifacts](https://www.trusted-setup-pse.org/)

{% hint style="info" %}
The external nullifier being used to prevent double-signaling is the string `bq-rate`. The generated proof can be verified off-chain via [Semaphore](https://semaphore.appliedzkp.org/docs/guides/proofs#verify-a-proof-off-chain).
{% endhint %}
