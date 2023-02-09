import { N_LEVELS, TEST_HEIGHT, Poseidon, TestAnswers, TestVariables, TestFullProof, buildPoseidon, generateOpenAnswers, generateTestProof, rootFromLeafArray, BigNumberish, Proof } from "@bq-core/proof"
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { expect } from "chai";
import { constants, Signer, utils } from "ethers"
import { run } from "hardhat";
import { describe } from "mocha";
import { Credentials } from "../typechain-types"

describe("Credentials contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity;

    let testAnswers: TestAnswers;
    let testVariables: TestVariables;
    let testURI = 'https://gateway.ipfs.io/ipfs/QmcniBv7UQ4gGPQQW2BwbD4ZZHzN3o3tPuNLZCbBchd1zh';
    
    let openAnswersHashes: BigNumberish[];
    let testRoot: BigNumberish;
    let testParameters: BigNumberish;
    let nonPassingTestParameters: BigNumberish;

    let gradeGroup = new Group(0, N_LEVELS);
    let credentialsGroup = new Group(0, N_LEVELS);
    let noCredentialsGroup = new Group(0, N_LEVELS);

    let credentialsContract: Credentials;
    let signers: Signer[];
    let accounts: string[];

    let passingProof: TestFullProof;
    let nonPassingProof: TestFullProof;
    
    let passingGradeCommitment: BigNumberish;
    let nonPassingGradeCommitment: BigNumberish;

    const snarkArtifacts = {
        wasmFilePath: "../proof/snark-artifacts/test.wasm",
        zkeyFilePath: "../proof/snark-artifacts/test.zkey"
    };

    before(async () => {
        poseidon = await buildPoseidon();

        signers = await run("accounts", { logs: false })
        accounts = await Promise.all(signers.map((signer: Signer) => signer.getAddress()))

        identity = new Identity("deenz")

        const _openAnswersHashes = [
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("sneed's")))]), 
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("feed")))]), 
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("seed")))])
        ]
        openAnswersHashes = Array(2 ** TEST_HEIGHT).fill( poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("")))]) )
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

        testRoot = poseidon([multipleChoiceRoot, openAnswersHashesRoot])
        testParameters = poseidon([testVariables.minimumGrade, testVariables.multipleChoiceWeight, testVariables.nQuestions])
        nonPassingTestParameters = poseidon([0, testVariables.multipleChoiceWeight, testVariables.nQuestions])

        passingProof = await generateTestProof(
            identity,
            testAnswers,
            testVariables,
            credentialsGroup,
            gradeGroup,
            snarkArtifacts
        )

        nonPassingProof = await generateTestProof(
            identity,
            { 
                multipleChoiceAnswers: Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 2), 
                openAnswers: Array(2 ** TEST_HEIGHT).fill( poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("")))]) ) 
            },
            { ...testVariables, minimumGrade: 0 },
            noCredentialsGroup,
            new Group(0, N_LEVELS),
            snarkArtifacts
        )

        passingGradeCommitment = passingProof.gradeCommitment
        nonPassingGradeCommitment = nonPassingProof.gradeCommitment
    })

    beforeEach(async () => {
        const { credentials } = await run("deploy:credentials", {
            logs: false
        })

        credentialsContract = credentials
    })

    context("Without created tests", () => {
        describe("createTest", () => {
            context("when the time limit given is in the past", () => {
                it("reverts for `timeLimit` > 0", async () => {
                    await expect(
                        credentialsContract.createTest(50, 50, 3, 1, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TimeLimitIsInThePast"
                    )
                })

                it("creates a new test for `timeLimit` = 0", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                })
            })

            context("when the number of questions given is invalid", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.createTest(50, 50, 0, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidNumberOfQuestions"
                    )
                    
                    await expect(
                        credentialsContract.createTest(50, 50, 65, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidNumberOfQuestions"
                    )
                })
            })

            context("when the minimum grade given is over 100", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.createTest(101, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidMinimumGrade"
                    )  
                })
            })

            context("when the multiple choice weight given is over 100", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.createTest(50, 101, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidMultipleChoiceWeight"
                    )
                })
            })
            
            context("after minting tests", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                })

                it("emits a `TestCreated` event", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "TestCreated")
                        .withArgs('0')
                })

                it("emits a `TestAdminUpdated` event", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "TestAdminUpdated")
                        .withArgs('0', constants.AddressZero, accounts[0])
                })
            })
        })

        describe("verifyTestAnswers", () => {
            context("when attempting to verify a test that doesn't exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.verifyTestAnswers(0, testVariables.openAnswersHashes)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })
        })

        describe("updateTestAdmin", () => {
            context("when attempting to update the admin of test that doesn't exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.updateTestAdmin(0, accounts[1])
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })
        })

        describe("invalidateTest", () => {
            context("when attempting to invalidate a test that doesn't exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.invalidateTest(0)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })
        })

        describe("solveTest", () => {
            context("when attempting to solve a test that doesn't exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.solveTest(
                            0, 
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot, 
                            passingProof.proof, 
                            true
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("when solving a test after its time limit was reached", () => {
                it("reverts", async () => {
                    mine()
                    const currentTimestamp = await time.latest()
                    await credentialsContract.createTest(50, 50, 3, currentTimestamp + 1, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    time.setNextBlockTimestamp(currentTimestamp + 101)
                    mine()

                    await expect(
                        credentialsContract.solveTest(
                            0, 
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot, 
                            passingProof.proof,
                            true
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TimeLimitReached"
                    )
                })
            })
        })

        describe("getTest", () => {
            context("when the `testId` given does not exist", () => {
                it("returns an empty `Test` struct", async () => {
                    expect((await credentialsContract.getTest(0)).slice(0,11).map( n => { return n.toString() }))
                        .to.deep.equal([0, 0, 0, 0, constants.AddressZero, 0, 0, 0, 0, 0])
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `Test` struct", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect((await credentialsContract.getTest(0)).slice(0,11).map( n => { return n.toString() }))
                        .to.deep.equal([50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters])
                })
            })
        })

        describe("getTestURI", () => {
            context("when the `testId` given does not exist", () => {
                it("returns an empty string", async () => {
                    expect(await credentialsContract.getTestURI(0))
                        .to.be.equal("")
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding testURI", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getTestURI(0))
                        .to.be.equal(testURI)
                })
            })
        })

        describe("getMultipleChoiceRoot", () => {
            context("when the `testId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getMultipleChoiceRoot(0))
                        .to.be.equal(0)
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `multipleChoiceRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getMultipleChoiceRoot(0))
                        .to.be.equal(testVariables.multipleChoiceRoot)
                })
            })
        })

        describe("getOpenAnswersHashesRoot", () => {
            context("when the `testId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getopenAnswersHashesRoot(0))
                        .to.be.equal(0)
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `openAnswersRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getopenAnswersHashesRoot(0))
                        .to.be.equal(testVariables.openAnswersHashesRoot)
                })
            })
        })

        describe("getOpenAnswersHashes", () => {
            context("when the `testId` given does not exist", () => {
                it("returns an empty array", async () => {
                    expect(await credentialsContract.getOpenAnswersHashes(0))
                        .to.deep.equal([])
                })
            })

            context("after minting a test", () => {
                it("returns an empty array", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getOpenAnswersHashes(0))
                        .to.deep.equal([])
                })
            })
        })

        describe("getTestRoot", () => {
            context("when the `testId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getTestRoot(0))
                        .to.be.equal(0)
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `testRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getTestRoot(0))
                        .to.be.equal(testRoot)
                })
            })
        })

        describe("getTestParameters", () => {
            context("when the `testId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getTestParameters(0))
                        .to.be.equal(0)
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `testParameters`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getTestParameters(0))
                        .to.be.equal(testParameters)
                })
            })
        })

        describe("getNonPassingTestParameters", () => {
            context("when the `testId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getNonPassingTestParameters(0))
                        .to.be.equal(0)
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `testParameters`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getNonPassingTestParameters(0))
                        .to.be.equal(nonPassingTestParameters)
                })

                it("returns the same `testParameters` as getTestParameters when the `minimumGrade` was set to zero", async () => {
                    await credentialsContract.createTest(0, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 
                    
                    expect(await credentialsContract.getTestParameters(0))
                        .to.be.equal(nonPassingTestParameters)
                    expect(await credentialsContract.getNonPassingTestParameters(0))
                        .to.be.equal(nonPassingTestParameters)
                })
            })
        })

        describe("testExists", () => {
            context("when the `testId` given does not exist", () => {
                it("returns false", async () => {
                    expect(await credentialsContract.testExists(0))
                        .to.be.equal(false)
                })
            })

            context("after minting a test", () => {
                it("returns true", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.testExists(0))
                        .to.be.equal(true)
                })
            })
        })

        describe("testIsValid", () => {
            context("when the `testId` given does not exist", () => {
                it("returns false", async () => {
                    expect(await credentialsContract.testIsValid(0))
                        .to.be.equal(false)                
                })
            })

            context("after minting a test", () => {
                it("returns true", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.testIsValid(0))
                        .to.be.equal(true)
                })
            })
        })

        describe("getMerkleTreeRoot", () => {
            context("when the `groupId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getMerkleTreeRoot(0))
                        .to.be.equal(0)  
                })
            })

            context("after minting a test", () => {
                it("returns the corresponding `merkleTreeRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    const emptyRoot = (new Group(0, N_LEVELS)).root

                    // Grade tree group
                    expect(await credentialsContract.getMerkleTreeRoot(0))
                        .to.be.equal(emptyRoot)
                    // Credentials tree group  
                    expect(await credentialsContract.getMerkleTreeRoot(1))
                        .to.be.equal(emptyRoot)  
                    // No credentials tree group
                    expect(await credentialsContract.getMerkleTreeRoot(2))
                        .to.be.equal(emptyRoot)  
                })
            })
        })

        describe("getMerkleTreeDepth", () => {
            it(`returns the default \`TREE_DEPTH\` set at ${N_LEVELS}`, async () => {
                expect(await credentialsContract.getMerkleTreeDepth(0))
                    .to.be.equal(N_LEVELS) 
            })
        })

        describe("getNumberOfMerkleTreeLeaves", () => {
            context("when the `testId` given does not exist", () => {
                it("returns 0", async () => {
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(0))
                        .to.be.equal(0) 
                })
            })

            context("after minting a test", () => {
                it("returns 0", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    // Grade tree group
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(0))
                        .to.be.equal(0)
                    // Credentials tree group  
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(1))
                        .to.be.equal(0)  
                    // No credentials tree group
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(2))
                        .to.be.equal(0)
                })
            })
        })
    })

    context("with created tests", () => {
        beforeEach(async () => {
            await credentialsContract.createTest(50, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
        })

        describe("verifyTestAnswers", () => {
            context("when being called by someone other than the admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.connect(signers[1]).verifyTestAnswers(0, openAnswersHashes)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "CallerIsNotTheTestAdmin"
                    )
                })
            })

            context("when providing an invalid number of answer hashes", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.verifyTestAnswers(0, [])
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidTestAnswersLength"
                    ).withArgs(
                        3, 0
                    )
                })
            })

            context("after verifying the answers for a given test", () => {
                beforeEach(async () => {
                    await credentialsContract.verifyTestAnswers(0, openAnswersHashes.slice(0,3))  
                })

                describe("getOpenAnswersHashes", () => {
                    it("returns the corresponding list of open answer hashes", async () => {
                        expect(await credentialsContract.getOpenAnswersHashes(0))
                            .to.deep.equal(openAnswersHashes.slice(0,3))
                    })
                })

                describe("verifyTestAnswers", () => {
                    it("reverts when trying to verify an already verified test", async () => {
                        await expect(
                            credentialsContract.verifyTestAnswers(0, [])
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestAnswersAlreadyVerified"
                        )
                    })
                })
            })
        })

        describe("updateTestAdmin", () => {
            context("when being called by someone other than the admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.connect(signers[1]).updateTestAdmin(0, accounts[1])
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "CallerIsNotTheTestAdmin"
                    )
                })
            })

            context("after setting up a new admin", () => {
                beforeEach(async () => {
                    await credentialsContract.updateTestAdmin(0, accounts[1] )
                })

                describe("getTest", () => {
                    it("shows the new admin as part of the `Test` struct", async () => {
                        expect((await credentialsContract.getTest(0))[4])
                            .to.equal(accounts[1])
                    })
                })

                describe("onlyTestAdmin modifier", () => {
                    it("reverts when being called by the old test admin", async () => {
                        await expect(
                            credentialsContract.updateTestAdmin(0, accounts[0])
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "CallerIsNotTheTestAdmin"
                        )
                    })

                    it("clears when being called by the new admin", async () => {
                        await credentialsContract.connect(signers[1]).updateTestAdmin(0, accounts[0])
                    })
                })
            })
        })

        describe("invalidateTest", () => {
            context("when being called by someone other than the admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.connect(signers[1]).invalidateTest(0)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "CallerIsNotTheTestAdmin"
                    )
                })
            })

            context("when being called by the admin", () => {
                it("emits a `TestInvalidated` event", async () => {
                    const tx = await credentialsContract.invalidateTest(0)

                    await expect(tx)
                        .to.emit(credentialsContract, "TestInvalidated")
                        .withArgs(0)
                })
            })

            context("after invalidating a test", () => {
                beforeEach(async () => {
                    await credentialsContract.invalidateTest(0)
                })

                describe("testIsValid", () => {
                    it("returns false", async () => {
                        expect(await credentialsContract.testIsValid(0))
                            .to.be.equal(false)
                    })
                })

                describe("getTest", () => {
                    it("shows the minimum grade to be 255 as part of the `Test` struct", async () => {
                        expect((await credentialsContract.getTest(0)).slice(0,11).map( n => { return n.toString() }))
                        .to.deep.equal([255, 50, 3, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters])
                    })
                })

                describe("invalidateTest", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.invalidateTest(0)
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestWasInvalidated"
                        )
                    })
                })

                describe("solveTest", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.solveTest(
                                0, 
                                passingProof.identityCommitment, 
                                passingProof.newIdentityTreeRoot,
                                passingProof.gradeCommitment,
                                passingProof.newGradeTreeRoot, 
                                passingProof.proof,
                                true
                            )                        
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestWasInvalidated"
                        )
                    })
                })
            })
        })

        describe("solveTest", () => {
            context("when providing an invalid proof", () => {
                it("reverts", async () => {
                    const bogusProof: Proof = [...passingProof.proof]
                    bogusProof[0] = BigInt(passingProof.proof[0]) + BigInt(1)

                    await expect(
                        credentialsContract.solveTest(
                            0, 
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot, 
                            bogusProof,
                            true
                        )
                    ).to.revertedWithoutReason
                })
            })

            context("when setting `testPassed` to true", () => {
                context("after a valid call", () => {
                    let tx;

                    beforeEach(async () => {
                        tx = await credentialsContract.solveTest(
                            0, 
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot, 
                            passingProof.proof,
                            true
                        )                        

                        credentialsGroup.updateMember(0, identity.commitment)
                        gradeGroup.updateMember(0, passingGradeCommitment)
                    })

                    it("increases the `credentialsTreeIndex` by one", async () => {
                        expect((await credentialsContract.getNumberOfMerkleTreeLeaves(1)))
                            .to.equal(credentialsGroup.members.length)
                    })
    
                    it("updates the `credentialsTreeRoot`", async () => {
                        expect((await credentialsContract.getMerkleTreeRoot(1)))
                            .to.equal(credentialsGroup.root)
                    })
    
                    it("emits a `MemberAdded` event for the credentials tree group", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "MemberAdded")
                            .withArgs(1, 0, identity.commitment, credentialsGroup.root)
                    })

                    it("emits a `CredentialsGained` event", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "CredentialsGained")
                            .withArgs(0, identity.commitment, passingGradeCommitment)
                    })
                })
            })

            context("when setting `testPassed` to false", () => {
                context("after a valid call", () => {
                    let tx;

                    beforeEach(async () => {
                        tx = await credentialsContract.solveTest(
                            0, 
                            nonPassingProof.identityCommitment, 
                            nonPassingProof.newIdentityTreeRoot,
                            nonPassingProof.gradeCommitment,
                            nonPassingProof.newGradeTreeRoot, 
                            nonPassingProof.proof,
                            false
                        )
                        
                        noCredentialsGroup.updateMember(0, identity.commitment)
                        gradeGroup.updateMember(0, passingGradeCommitment)
                    })

                    it("increases the `noCredentialsTreeIndex` by one", async () => {
                        expect((await credentialsContract.getNumberOfMerkleTreeLeaves(2)))
                            .to.equal(noCredentialsGroup.members.length)
                    })
    
                    it("updates the `noCredentialsTreeRoot`", async () => {
                        expect((await credentialsContract.getMerkleTreeRoot(2)))
                            .to.equal(noCredentialsGroup.root)
                    })
    
                    it("emits a `MemberAdded` event for the no credentials tree", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "MemberAdded")
                            .withArgs(2, 0, identity.commitment, noCredentialsGroup.root)
                    })

                    it("emits a `CredentialsNotGained` event", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "CredentialsNotGained")
                            .withArgs(0, identity.commitment, nonPassingGradeCommitment)
                    })
                })
            })

            context("after a valid call", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsContract.solveTest(
                        0, 
                        passingProof.identityCommitment, 
                        passingProof.newIdentityTreeRoot,
                        passingProof.gradeCommitment,
                        passingProof.newGradeTreeRoot, 
                        passingProof.proof,
                        true
                    )
                    
                    credentialsGroup.addMember(identity.commitment)
                    gradeGroup.updateMember(0, passingGradeCommitment)
                })

                it("increases the `gradeTreeIndex` by one", async () => {
                    expect((await credentialsContract.getNumberOfMerkleTreeLeaves(0)))
                        .to.equal(gradeGroup.members.length)
                })

                it("updates the `gradeTreeRoot`", async () => {
                    expect((await credentialsContract.getMerkleTreeRoot(0)))
                        .to.equal(gradeGroup.root)
                })

                it("emits a `MemberAdded` event for the grade tree group", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "MemberAdded")
                        .withArgs(0, 0, passingGradeCommitment, gradeGroup.root)
                })
            })
        })
    })

    // TREE GOT FULL: the passingProof would revert, as the index inside the smart contract would be set to 2**N_LEVELS, whereas the max index the circuit can output is 2**N_LEVELS - 1
})
