import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group";
import { expect } from "chai";
import { wasm, WasmTester } from "circom_tester";
import { utils } from "ethers"
import { describe } from "mocha";
import path from "path";
import { circuitShouldFail } from "./utils/circuitShouldFail";
import { Poseidon, buildPoseidon, generateOpenAnswers, rootFromLeafArray } from "../../proof/src";

describe("Test Circuit", () => {
    let circuitTester: WasmTester;
    let poseidon: Poseidon;

    let identity: Identity;

    let multipleChoiceRoot: bigint;
    let openAnswersHashes: bigint[];
    let openAnswersHashesRoot: bigint;
    let multipleChoiceAnswers: number[];
    let openAnswers: BigInt[];

    let gradeGroup = new Group(0, 16);
    let identityGroup = new Group(0, 16);

    let inputs: any;

    let circuitOutputs: bigint[];
    
    let gradeCommitment: bigint;

    before( async function () {
        circuitTester = await wasm(path.join(__dirname, "../circuits", "test.circom"))
        poseidon = await buildPoseidon();

        identity = new Identity("deenz")

        multipleChoiceRoot = rootFromLeafArray(poseidon, Array.from({length: 64}, (_, i) => 1))

        const _openAnswersHashes = [
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("sneed's")))]), 
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("feed")))]), 
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("seed")))])
        ]
        openAnswersHashes = Array(64).fill( poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("")))] ))
        openAnswersHashes.forEach( (_, i) => { if (i < _openAnswersHashes.length) { openAnswersHashes[i] = _openAnswersHashes[i] }})

        openAnswersHashesRoot = rootFromLeafArray(poseidon, openAnswersHashes)

        multipleChoiceAnswers = Array.from({length: 64}, (_, i) => 1)

        openAnswers = generateOpenAnswers(["sneed's", "feed", "seed"])

        gradeGroup.addMember(gradeGroup.zeroValue)
        identityGroup.addMember(identityGroup.zeroValue)

        const gradeTreeProof = gradeGroup.generateMerkleProof(0)
        const identityTreeProof = identityGroup.generateMerkleProof(0)

        inputs = {
            minimumGrade: 50,
            multipleChoiceWeight: 50,
            nQuestions: 3,
            multipleChoiceAnswers,
            multipleChoiceRoot,
            openAnswers: openAnswers,
            openAnswersHashes: openAnswersHashes,
            openAnswersHashesRoot: openAnswersHashesRoot,
            identityNullifier: identity.nullifier,
            identityTrapdoor: identity.trapdoor,
            identityTreeEmptyLeaf: identityGroup.zeroValue,
            identityTreePathIndices: identityTreeProof.pathIndices,
            identityTreeSiblings: identityTreeProof.siblings,
            gradeTreeEmptyLeaf: gradeGroup.zeroValue,
            gradeTreePathIndices: gradeTreeProof.pathIndices,
            gradeTreeSiblings: gradeTreeProof.siblings
        };
    })

    describe("Generating proof", async () => {
        it("Generates a valid SNARK proof", async () => {
            const witness = await circuitTester.calculateWitness(inputs, true);
            await circuitTester.checkConstraints(witness);

            circuitOutputs = witness.slice(1, 11);
        })
    })

    describe("Verifying that `identityTree` and `gradeTree` are correct", async () => {
        it("Throws when using an `identityTree` with the wrong height", async () => {
            const _inputs1 = {
                ...inputs,
                identityTreePathIndices: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs1,
            }, "Not all inputs have been set. Only 250 out of 265");
            

            const _inputs2 = {
                ...inputs,
                identityTreeSiblings: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs2,
            }, "Not all inputs have been set. Only 250 out of 265");
        })
        
        it("Throws when using an `gradeTree` with the wrong height", async () => {
            const _inputs1 = {
                ...inputs,
                gradeTreePathIndices: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs1,
            }, "Not all inputs have been set. Only 250 out of 265");
            

            const _inputs2 = {
                ...inputs,
                gradeTreeSiblings: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs2,
            }, "Not all inputs have been set. Only 250 out of 265");
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
            }, "Not all inputs have been set. Only 202 out of 265");
        })

        it("Throws when using the wrong number of `openAnswers`", async () => {
            const _inputs = {
                ...inputs,
                openAnswers: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Not all inputs have been set. Only 202 out of 265");
        })

        it("Throws when using the wrong number of `openAnswersHashes`", async () => {
            const _inputs = {
                ...inputs,
                openAnswersHashes: [1],
            }
            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Not all inputs have been set. Only 202 out of 265");
        })
    })

    describe("Verifying the commitment indices", async () => {
        it("Outputs the correct `identityCommitmentIndex`", async () => {
            expect(circuitOutputs[0].toString()).to.equal('0')
        })

        it("Outputs the correct `gradeCommitmentIndex`", async () => {
            expect(circuitOutputs[4].toString()).to.equal('0')
        })
    })

    describe("Verifying the commitment values", async () => {
        it("Outputs the correct `identityCommitment`", async () => {
            expect(circuitOutputs[1].toString()).to.equal(identity.commitment.toString())
        })

        it("Outputs the correct `gradeCommitment`, computing the correct grade in the process", async () => {
            gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), 100 * inputs.nQuestions])
            expect(circuitOutputs[5].toString()).to.equal(gradeCommitment.toString())
        })
    })

    describe("Verifying the tree root values", async () => {
        it("Outputs the correct `oldIdentityTreeRoot`", async () => {
            expect(circuitOutputs[2].toString()).to.equal(identityGroup.root.toString())
        })

        it("Outputs the correct `newIdentityTreeRoot`", async () => {
            identityGroup.updateMember(0, identity.commitment)
            expect(circuitOutputs[3].toString()).to.equal(identityGroup.root.toString())
        })

        it("Outputs the correct `oldGradeTreeRoot`", async () => {
            expect(circuitOutputs[6].toString()).to.equal(gradeGroup.root.toString())
        })

        it("Outputs the correct `newGradeTreeRoot`", async () => {
            gradeGroup.updateMember(0, gradeCommitment)
            expect(circuitOutputs[7].toString()).to.equal(gradeGroup.root.toString())
        })
    })

    describe("Verifying the test values", async () => {
        it("Outputs the correct `testRoot`", async () => {
            expect(circuitOutputs[8].toString()).to.equal(poseidon([multipleChoiceRoot, openAnswersHashesRoot]).toString())
        })

        it("Outputs the correct `testParameters`", async () => {
            expect(circuitOutputs[9].toString()).to.equal(poseidon([inputs.minimumGrade, inputs.multipleChoiceWeight, inputs.nQuestions]).toString())
        })
    })

    describe("Verifying the grade calculation", async () => {
        it("Throws when the grade obtained is below the specified `minimumGrade`", async () => {
            const _inputs = {
                ...inputs,
                multipleChoiceAnswers: Array.from({length: 64}, (_, i) => 2),
                openAnswers: generateOpenAnswers([]),
            }

            await circuitShouldFail(circuitTester, {
                ..._inputs,
            }, "Error: Assert Failed. Error in template VerifyMixedTest");
        })

        it("Does not throw when the `minimumGrade` is set to zero", async () => {
            const _inputs = {
                ...inputs,
                minimumGrade: 0,
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

            const _gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), expectedGrade])
            expect(witness[6].toString()).to.equal(_gradeCommitment.toString())
            
            gradeGroup.updateMember(0, _gradeCommitment)
            expect(witness[8].toString()).to.equal(gradeGroup.root.toString())
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

            const _gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), expectedGrade])
            expect(witness[6].toString()).to.equal(_gradeCommitment.toString())
        
            gradeGroup.updateMember(0, _gradeCommitment)
            expect(witness[8].toString()).to.equal(gradeGroup.root.toString())
        })
    })
})