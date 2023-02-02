import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group";
import { expect } from "chai";
import { wasm, WasmTester } from "circom_tester";
import { describe } from "mocha";
import path from "path";
import { circuitShouldFail } from "./utils/circuitShouldFail";
import { Poseidon, buildPoseidon } from "../../proof/src";

describe("GradeClaim Circuit", () => {
    let circuitTester: WasmTester;
    let poseidon: Poseidon;

    let identity: Identity;

    let gradeGroup = new Group(0, 16);
    
    let grade: number;
    let gradeCommitment: bigint;
    let externalNullifier: number;

    let inputs: any;

    let circuitOutputs: bigint[];

    before( async function () {
        circuitTester = await wasm(path.join(__dirname, "../circuits", "grade_claim.circom"))
        poseidon = await buildPoseidon();

        identity = new Identity("deenz")

        grade = 80
        gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), grade])
        gradeGroup.addMember(gradeCommitment)

        externalNullifier = 350

        const gradeTreeProof = gradeGroup.generateMerkleProof(0)

        inputs = {
            identityNullifier: identity.nullifier,
            identityTrapdoor: identity.trapdoor,
            gradeTreePathIndices: gradeTreeProof.pathIndices,
            gradeTreeSiblings: gradeTreeProof.siblings,
            grade,
            gradeThreshold: 50,
            externalNullifier
        }
    })

    describe("Generating proof", async () => {
        it("Generates a valid SNARK proof", async () => {
            const gradeAboveWitness = await circuitTester.calculateWitness(inputs, true);
            await circuitTester.checkConstraints(gradeAboveWitness);

            circuitOutputs = gradeAboveWitness.slice(1, 5);
        })
    })

    describe("Verifying that `gradeTreePathIndices` and `gradeTreeSiblings` are correct", async () => {
        it("Throws when using a tree with the wrong height", async () => {
            const _inputs = {
                ...inputs,
                gradeTreePathIndices: [1],
            }

            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Not all inputs have been set. Only 22 out of 37");
        })
    })

    describe("Verifying the grade tree root computation", () => {
        it("Outputs the right `gradeTreeRoot`", async () => {
            expect(circuitOutputs[0].toString()).to.equal(gradeGroup.root.toString())
        })
    })

    describe("Verifying the nullifier hash computation", () => {
        it("Outputs the right `nullifierHash`", async () => {
            expect(circuitOutputs[1].toString()).to.equal(poseidon([externalNullifier, identity.nullifier]).toString())
        })
    })

    describe("Verifying the grade claim inequality", () => {
        it("Throws when the `grade` is less than the `gradeThreshold`", async () => {
            const _inputs = {
                ...inputs,
                gradeThreshold: grade + 1
            }

            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Error: Assert Failed. Error in template GradeClaim");
        })

        it("Generates a valid SNARK proof when the `grade` is equal to the `gradeThreshold`", async () => {
            const _inputs = {
                ...inputs,
                gradeThreshold: grade
            }

            const equalGradeWitness = await circuitTester.calculateWitness(_inputs, true);
            await circuitTester.checkConstraints(equalGradeWitness);
        })
    })
})
