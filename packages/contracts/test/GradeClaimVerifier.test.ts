import {  
    buildPoseidon,
    generateGradeClaimProof, 
    GradeClaimFullProof, 
    Poseidon, 
    MAX_TREE_DEPTH,
    BigNumberish,
} from "@bq2/lib"
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { expect } from "chai";
import { Signer } from "ethers"
import { ethers, run } from "hardhat";
import { describe } from "mocha";
import { GradeClaimVerifier, Pairing } from "../typechain-types"

describe("GradeClaimVerifier contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity

    let gradeGroup = new Group(1, MAX_TREE_DEPTH);

    let nQuestions = 3;
    let multipleChoiceWeight = 50;
    let grade = 100;
    let gradeThreshold = 50;
    let gradeCommitment: BigNumberish;

    let externalNullifier = 350;
    let signal = ethers.utils.formatBytes32String("I need bout tree fiddy");

    let gradeClaimVerifierContract: GradeClaimVerifier;
    let pairingContract: Pairing

    let signers: Signer[];
    let accounts: string[];

    let proof: GradeClaimFullProof;

    const snarkArtifacts = {
        wasmFilePath: "../snark-artifacts/gradeClaim.wasm",
        zkeyFilePath: "../snark-artifacts/gradeClaim.zkey"
    }

    before(async () => {
        poseidon = await buildPoseidon();

        const { gradeClaimVerifier, pairing } = await run("deploy:grade-claim-verifier", {
            logs: false
        })

        gradeClaimVerifierContract = gradeClaimVerifier
        pairingContract = pairing

        signers = await run("accounts", { logs: false })
        accounts = await Promise.all(signers.map((signer: Signer) => signer.getAddress()))

        identity = new Identity("deenz")    

        gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), grade * nQuestions])
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
        it("Should clear when verifying a valid proof", async () => {
            await gradeClaimVerifierContract.verifyProof(
                proof.gradeTreeRoot, 
                proof.nullifierHash, 
                proof.gradeThreshold, 
                proof.signal, 
                proof.externalNullifier,
                proof.proof,
                MAX_TREE_DEPTH
            )
        })

        it("Should revert when verifying a valid proof that has a changed public input", async () => {
            await expect(
                gradeClaimVerifierContract.verifyProof(
                    BigInt(350),  // bout tree fiddy
                    proof.nullifierHash, 
                    proof.gradeThreshold, 
                    proof.signal, 
                    proof.externalNullifier,
                    proof.proof,
                    MAX_TREE_DEPTH
                ) 
            ).to.be.revertedWithCustomError(
                pairingContract,
                "InvalidProof"
            )
        })
    })
})
