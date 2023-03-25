import {  
    buildPoseidon, 
    generateOpenAnswers,
    generateTestProof, 
    hash,
    rootFromLeafArray, 
    Poseidon, 
    TestAnswers, 
    TestFullProof,
    TestVariables, 
    MAX_TREE_DEPTH, 
    TEST_HEIGHT,
} from "@bq2/lib"
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { expect } from "chai";
import { Signer, utils } from "ethers"
import { run } from "hardhat";
import { describe } from "mocha";
import { Pairing, TestVerifier } from "../typechain-types"

describe("TestVerifier contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity

    let testAnswers: TestAnswers;
    let testVariables: TestVariables;

    let identityGroup: Group;
    let gradeGroup: Group;

    let testVerifierContract: TestVerifier;
    let pairingContract: Pairing

    let signers: Signer[];
    let accounts: string[];

    let proof: TestFullProof;

    const snarkArtifacts = {
        wasmFilePath: "../snark-artifacts/test.wasm",
        zkeyFilePath: "../snark-artifacts/test.zkey"
    }

    before(async () => {
        poseidon = await buildPoseidon();

        const { testVerifier, pairing } = await run("deploy:test-verifier", {
            logs: false
        })

        testVerifierContract = testVerifier
        pairingContract = pairing

        signers = await run("accounts", { logs: false })
        accounts = await Promise.all(signers.map((signer: Signer) => signer.getAddress()))

        identity = new Identity("deenz")

        const _openAnswersHashes = [
            poseidon([hash("sneed's")]), 
            poseidon([hash("feed")]), 
            poseidon([hash("seed")])
        ]
        const openAnswersHashes = Array(2 ** TEST_HEIGHT).fill( poseidon([hash("")]) )
        openAnswersHashes.forEach( (_, i) => { if (i < _openAnswersHashes.length) { openAnswersHashes[i] = _openAnswersHashes[i] }})
        
        const multipleChoiceRoot = rootFromLeafArray(poseidon, Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1))
        const openAnswersHashesRoot = rootFromLeafArray(poseidon, openAnswersHashes)

        const multipleChoiceAnswers = Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1)
        const openAnswers = generateOpenAnswers(["sneed's", "feed", "seed"])

        testAnswers = {
            multipleChoiceAnswers,
            openAnswers
        }

        testVariables = {
            minimumGrade: 50,
            multipleChoiceWeight: 50, 
            nQuestions: 3,
            multipleChoiceRoot,
            openAnswersHashesRoot,
            openAnswersHashes
        }

        identityGroup = new Group(1, MAX_TREE_DEPTH)
        gradeGroup = new Group(1, MAX_TREE_DEPTH)
    })

    it("Should be able to generate the proof using the prover package", async () => {
        proof = await generateTestProof(
            identity,
            testAnswers,
            testVariables,
            identityGroup,
            gradeGroup,
            true,
            snarkArtifacts
        )
    })

    describe("verifyProof", () => {
        it("Should clear when verifying a valid proof", async () => {
            await testVerifierContract.verifyProof(
                proof.proof,
                proof.publicSignals
            )
        })

        it("Should revert when verifying a valid proof that has a changed public input", async () => {
            const bogusSignals = [...proof.publicSignals]
            bogusSignals[0] = BigInt(350)  // bout tree fiddy

            await expect(
                testVerifierContract.verifyProof(proof.proof, bogusSignals)
            ).to.be.revertedWithCustomError(
                testVerifierContract,
                "InvalidProof"
            )
        })
    })
})
