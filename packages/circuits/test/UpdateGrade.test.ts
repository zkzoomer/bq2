import { Identity } from "@semaphore-protocol/identity"
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree"
import { expect } from "chai";
import { wasm, WasmTester } from "circom_tester";
import { BigNumber } from "ethers";
import { keccak256  } from 'js-sha3';
import { describe } from "mocha";
import path from "path";
import { buildPoseidon, circuitShouldFail, generateOpenAnswers, Poseidon, rootFromLeafArray } from "./utils";
import { ZERO_LEAF } from "../../proof/src";

describe("UpdateGrade Circuit", async function () {
    let circuitTester: WasmTester;
    let poseidon: Poseidon;

    let identityTrapdoor: bigint;
    let identityNullifier: bigint;
    let identityCommitment: bigint;

    let solutionHash: BigNumber;
    let openAnswersHashes: BigNumber[];
    let openAnswersHashesRoot: BigNumber;
    let multipleChoiceAnswers: number[];
    let openAnswers: BigNumber[];

    let gradeTree: IncrementalMerkleTree;

    let inputs: {
        minimumGrade: number;
        multipleChoiceWeight: number;
        nQuestions: number;
        multipleChoiceAnswers: number[];
        solutionHash: BigNumber;
        openAnswers: BigNumber[];
        openAnswersHashes: BigNumber[];
        openAnswersHashesRoot: any;
        identityNullifier: bigint;
        identityTrapdoor: bigint;
        currentGrade: number;
        gradeTreePathIndices: number[];
        gradeTreeSiblings: any[];
    }

    let circuitOutputs: BigInt[];
    
    let oldGradeCommitment: BigNumber;
    let newGradeCommitment: BigNumber;

    before( async function () {
        circuitTester = await wasm(path.join(__dirname, "../circuits", "grade_update.circom"))
        poseidon = await buildPoseidon();

        const identity = new Identity("deenz")
        identityTrapdoor = identity.getTrapdoor()
        identityNullifier = identity.getNullifier()
        identityCommitment = identity.getCommitment()

        // Hereon we define a series of tests to be used when testing the smart contracts / scripts
        // Multiple choice component
        solutionHash = rootFromLeafArray(poseidon, Array.from({length: 64}, (_, i) => 1))

        // Open answer component
        const _openAnswersHashes = [poseidon([BigInt('0x' + keccak256("sneed's"))]), poseidon([BigInt('0x' + keccak256("feed"))]), poseidon([BigInt('0x' + keccak256("seed"))])]
        openAnswersHashes = Array(64).fill( poseidon([BigInt('0x' + keccak256(""))] ))
        openAnswersHashes.forEach( (_, i) => { if (i < _openAnswersHashes.length) { openAnswersHashes[i] = _openAnswersHashes[i] }})

        openAnswersHashesRoot = rootFromLeafArray(poseidon, openAnswersHashes)

        multipleChoiceAnswers = Array.from({length: 64}, (_, i) => 1)

        openAnswers = generateOpenAnswers(["sneed's", "feed", "seed"])

        const _openAnswersB = new Array(64).fill("sneed's")
        _openAnswersB[0] = "tree"
        _openAnswersB[1] = "fiddy"

        gradeTree = new IncrementalMerkleTree(poseidon, 16, ZERO_LEAF)

        // We will have an initial leaf which we will improve upon
        const currentGrade = 16
        oldGradeCommitment = poseidon([poseidon([identityNullifier, identityTrapdoor]), currentGrade])
        gradeTree.insert(oldGradeCommitment.toString())
    
        const gradeTreeProof = gradeTree.createProof(0);

        inputs = {
            minimumGrade: 50,
            multipleChoiceWeight: 50,
            nQuestions: 3,
            multipleChoiceAnswers,
            solutionHash,
            openAnswers,
            openAnswersHashes,
            openAnswersHashesRoot,
            identityNullifier,
            identityTrapdoor,
            currentGrade,
            gradeTreePathIndices: gradeTreeProof.pathIndices,
            gradeTreeSiblings: gradeTreeProof.siblings
        }
    })

    describe("Generating proof", async () => {
        it("Generates a valid SNARK proof", async () => {
            const witness = await circuitTester.calculateWitness(inputs, true);
            await circuitTester.checkConstraints(witness);

            circuitOutputs = witness.slice(1, 8);
        })
    })

    describe("Verifying that the `gradeTree` is correct", async () => {
        it("Throws when using an `gradeTree` with the wrong height", async () => {
            const _inputs1 = {
                ...inputs,
                gradeTreePathIndices: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs1,
            }, "Not all inputs have been set. Only 217 out of 232");
            

            const _inputs2 = {
                ...inputs,
                gradeTreeSiblings: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs2,
            }, "Not all inputs have been set. Only 217 out of 232");
        })
    })

    describe("Verifying that `multipleChoiceAnswers`, `openAnswers` and `openAnswersHashes` are correct", async () => {
        it("Throws when using the wrong number of `multipleChoiceAnswers`", async () => {
            const _inputs = {
                ...inputs,
                multipleChoiceAnswers: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Not all inputs have been set. Only 169 out of 232");
        })

        it("Throws when using the wrong number of `openAnswers`", async () => {
            const _inputs = {
                ...inputs,
                openAnswers: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Not all inputs have been set. Only 169 out of 232");
        })

        it("Throws when using the wrong number of `openAnswersHashes`", async () => {
            const _inputs = {
                ...inputs,
                openAnswersHashes: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Not all inputs have been set. Only 169 out of 232");
        })
    })

    describe("Verifying the commitment indices", async () => {
        it("Outputs the correct `gradeCommitmentIndex`", async () => {
            expect(circuitOutputs[0].toString()).to.equal('0')
        })
    })

    describe("Verifying the commitment values", async () => {
        it("Outputs the correct `oldGradeCommitment`", async () => {
            expect(circuitOutputs[1].toString()).to.equal(oldGradeCommitment.toString())
        })

        it("Outputs the correct `newGradeCommitment`, computing the correct grade in the process", async () => {
            newGradeCommitment = poseidon([poseidon([identityNullifier, identityTrapdoor]), 100 * inputs.nQuestions])
            expect(circuitOutputs[2].toString()).to.equal(newGradeCommitment.toString())
        })
    })

    describe("Verifying the tree root values", async () => {
        it("Outputs the correct `oldGradeTreeRoot`", async () => {
            expect(circuitOutputs[3].toString()).to.equal(gradeTree.root.toString())
        })

        it("Outputs the correct `newGradeTreeRoot`", async () => {
            gradeTree.update(0, newGradeCommitment.toString());
            expect(circuitOutputs[4].toString()).to.equal(gradeTree.root.toString())
        })
    })

    describe("Verifying the test values", async () => {
        it("Outputs the correct `testRoot`", async () => {
            expect(circuitOutputs[5].toString()).to.equal(poseidon([solutionHash, openAnswersHashesRoot]).toString())
        })

        it("Outputs the correct `testParameters`", async () => {
            expect(circuitOutputs[6].toString()).to.equal(poseidon([inputs.minimumGrade, inputs.multipleChoiceWeight, inputs.nQuestions]).toString())
        })
    })

    describe("Verifying the grade calculation", async () => {
        it("Throws when the grade obtained is below the current `currentGrade`", async () => {
            const _inputs = {
                ...inputs,
                multipleChoiceAnswers: Array.from({length: 64}, (_, i) => 2),
                openAnswers: generateOpenAnswers([]),
            }

            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Error: Assert Failed. Error in template VerifyMixedTest");
        })

        it("Does not throw when the `currentGrade` is set to zero", async () => {
            const _inputs = {
                ...inputs,
                currentGrade: 0,
                multipleChoiceAnswers: Array.from({length: 64}, (_, i) => 2),
                openAnswers: generateOpenAnswers([]),
            }

            const witness = await circuitTester.calculateWitness(_inputs, true);
            await circuitTester.checkConstraints(witness);
        })

        it("Counts the appropriate number of open answers that are right", async () => {
            const _inputs = {
                ...inputs,
                openAnswers: generateOpenAnswers(["sneed's"])
            }

            const witness = await circuitTester.calculateWitness(_inputs, true);
            await circuitTester.checkConstraints(witness);

            const expectedGrade = Math.floor(
                _inputs.multipleChoiceWeight * _inputs.nQuestions + 
                (100 - _inputs.multipleChoiceWeight) * (_inputs.nQuestions - 2)
            )

            const _gradeCommitment = poseidon([poseidon([identityNullifier, identityTrapdoor]), expectedGrade])
            expect(witness[3].toString()).to.equal(_gradeCommitment.toString())
            
            gradeTree.update(0, _gradeCommitment)
            expect(witness[5].toString()).to.equal(gradeTree.root.toString())
        })

        it("Adds the `multipleChoiceWeight` only when obtained", async () => {
            const _inputs = {
                ...inputs,
                multipleChoiceAnswers: Array.from({length: 64}, (_, i) => 2),
                openAnswers: generateOpenAnswers(["sneed's", "feed", "seed"])
            }

            const witness = await circuitTester.calculateWitness(_inputs, true);
            await circuitTester.checkConstraints(witness);

            const expectedGrade = Math.floor(
                (100 - _inputs.multipleChoiceWeight) * _inputs.nQuestions
            )

            const _gradeCommitment = poseidon([poseidon([identityNullifier, identityTrapdoor]), expectedGrade])
            expect(witness[3].toString()).to.equal(_gradeCommitment.toString())

            gradeTree.update(0, _gradeCommitment)
            expect(witness[5].toString()).to.equal(gradeTree.root.toString())
        })
    })
})