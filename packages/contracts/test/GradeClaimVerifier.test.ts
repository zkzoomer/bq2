import {  
    buildPoseidon,
    generateGradeClaimProof, 
    hash, 
    GradeClaimFullProof, 
    Poseidon, 
    N_LEVELS,
} from "@bq2/lib"
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { expect } from "chai";
import { Signer } from "ethers"
import { run } from "hardhat";
import { describe } from "mocha";
import { TestVerifier } from "../typechain-types"

describe("GradeClaimVerifier contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity

    let gradeGroup = new Group(0, N_LEVELS);

    let nQuestions = 10;
    let multipleChoiceWeight = 50;
    let grade = 80;
    let gradeThreshold = 50;
    let weightedGrade = grade * nQuestions;
    let gradeCommitment: bigint;

    let externalNullifier = 350;
    let signal = "I need bout tree fiddy";

    let gradeClaimVerifierContract: TestVerifier;
    let signers: Signer[];
    let accounts: string[];

    let proof: GradeClaimFullProof;

    const snarkArtifacts = {
        wasmFilePath: "../lib/snark-artifacts/gradeClaim.wasm",
        zkeyFilePath: "../lib/snark-artifacts/gradeClaim.zkey"
    }

    before(async () => {
        poseidon = await buildPoseidon();

        const { gradeClaimVerifier } = await run("deploy:grade-claim-verifier", {
            logs: false
        })

        gradeClaimVerifierContract = gradeClaimVerifier

        signers = await run("accounts", { logs: false })
        accounts = await Promise.all(signers.map((signer: Signer) => signer.getAddress()))

        identity = new Identity("deenz")

        gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), weightedGrade])
        gradeGroup.addMember(gradeCommitment)
    })

    it("Should be able to generate the proof using the prover package", async () => {
        proof = await generateGradeClaimProof(
            identity,
            gradeGroup,
            gradeThreshold,
            externalNullifier,
            signal,
            { multipleChoiceWeight, nQuestions },
            snarkArtifacts
        )
    })

    describe("verifyProof", () => {
        it("Should return `true` when verifying a valid proof", async () => {
            const isValid = await gradeClaimVerifierContract.verifyProof(
                proof.proof,
                [proof.gradeTreeRoot, proof.nullifierHash, proof.weightedGradeThreshold, hash(proof.signal), hash(externalNullifier)]
            ) 
            expect(isValid).to.be.equal(true)
        })

        it("Should return `false` when verifying a valid proof that has a changed public input", async () => {
            const bogusSignals = [proof.gradeTreeRoot, proof.nullifierHash, proof.weightedGradeThreshold, hash(proof.signal), hash(externalNullifier)]

            bogusSignals[0] = BigInt(350)  // bout tree fiddy

            const notValid = await gradeClaimVerifierContract.verifyProof(
                proof.proof,
                bogusSignals
            ) 
            expect(notValid).to.be.equal(false)
        })
    })
})
