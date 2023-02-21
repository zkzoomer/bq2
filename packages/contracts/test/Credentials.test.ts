import { 
    buildPoseidon,
    generateCredentialRestrictedTestProof,
    generateGradeRestrictedTestProof,
    generateOpenAnswers, 
    generateRateCredentialIssuerProof, 
    generateTestProof, 
    hash,
    rootFromLeafArray,  
    BigNumberish,
    CredentialRestrictedTestFullProof,
    GradeRestrictedTestFullProof,
    Proof,   
    Poseidon, 
    RateFullProof,
    TestAnswers, 
    TestFullProof,
    TestVariables, 
    N_LEVELS, 
    TEST_HEIGHT
} from "@bq2/lib"
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, FullProof } from "@semaphore-protocol/proof";
import { expect } from "chai";
import { Signer } from "ethers"
import { ethers, run } from "hardhat";
import { describe } from "mocha";
import { Credentials } from "../typechain-types"

describe("Credentials contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity;
    let altIdentity: Identity;

    let testAnswers: TestAnswers;
    let testVariables: TestVariables;
    let testURI = 'https://gateway.ipfs.io/ipfs/QmcniBv7UQ4gGPQQW2BwbD4ZZHzN3o3tPuNLZCbBchd1zh';
    
    let openAnswersHashes: BigNumberish[];
    let testRoot: BigNumberish;
    let testParameters: BigNumberish;
    let nonPassingTestParameters: BigNumberish;

    let gradeGroup = new Group(1, N_LEVELS);
    let credentialsGroup = new Group(1, N_LEVELS);
    let noCredentialsGroup = new Group(1, N_LEVELS);

    let credentialsContract: Credentials;
    let signers: Signer[];
    let accounts: string[];

    let passingProof: TestFullProof;
    let altPassingProof: TestFullProof;
    let nonPassingProof: TestFullProof;
    
    let passingGradeCommitment: BigNumberish;
    let nonPassingGradeCommitment: BigNumberish;

    let ratingProof: RateFullProof
    let altRatingProof: RateFullProof

    let requiredGradeThreshold = 60;

    const gradeClaimSnarkArtifacts = {
        wasmFilePath: '../lib/snark-artifacts/gradeClaim.wasm',
        zkeyFilePath: `../lib/snark-artifacts/gradeClaim.zkey`
    }
    
    const semaphoreSnarkArtifacts = {
        wasmFilePath: '../lib/snark-artifacts/semaphore.wasm',
        zkeyFilePath: `../lib/snark-artifacts/semaphore.zkey`
    };

    const testSnarkArtifacts = {
        wasmFilePath: "../lib/snark-artifacts/test.wasm",
        zkeyFilePath: "../lib/snark-artifacts/test.zkey"
    };

    before(async () => {
        poseidon = await buildPoseidon();

        signers = await run("accounts", { logs: false })
        accounts = await Promise.all(signers.map((signer: Signer) => signer.getAddress()))

        identity = new Identity("deenz")
        altIdentity = new Identity("sneed")

        const _openAnswersHashes = [
            poseidon([hash("sneed's")]), 
            poseidon([hash("feed")]), 
            poseidon([hash("seed")])
        ]
        openAnswersHashes = Array(2 ** TEST_HEIGHT).fill( poseidon([hash("")]) )
        openAnswersHashes.forEach( (_, i) => { if (i < _openAnswersHashes.length) { openAnswersHashes[i] = _openAnswersHashes[i] }})
        
        const multipleChoiceRoot = rootFromLeafArray(poseidon, Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1)).toString()
        const openAnswersHashesRoot = rootFromLeafArray(poseidon, openAnswersHashes).toString()

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

        testRoot = poseidon([multipleChoiceRoot, openAnswersHashesRoot]).toString()
        testParameters = poseidon([testVariables.minimumGrade, testVariables.multipleChoiceWeight, testVariables.nQuestions]).toString()
        nonPassingTestParameters = poseidon([0, testVariables.multipleChoiceWeight, testVariables.nQuestions]).toString()

        passingProof = await generateTestProof(
            identity,
            testAnswers,
            testVariables,
            credentialsGroup,
            gradeGroup,
            testSnarkArtifacts
        )

        credentialsGroup.updateMember(0, identity.commitment)
        gradeGroup.updateMember(0, passingProof.gradeCommitment)

        altPassingProof = await generateTestProof(
            altIdentity,
            testAnswers,
            testVariables,
            credentialsGroup,
            gradeGroup,
            testSnarkArtifacts
        )

        nonPassingProof = await generateTestProof(
            identity,
            { 
                multipleChoiceAnswers: Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 2), 
                openAnswers: Array(2 ** TEST_HEIGHT).fill( poseidon([hash("")]) ) 
            },
            { ...testVariables, minimumGrade: 0 },
            noCredentialsGroup,
            new Group(1, N_LEVELS),
            testSnarkArtifacts
        )

        passingGradeCommitment = passingProof.gradeCommitment
        nonPassingGradeCommitment = nonPassingProof.gradeCommitment

        const ratingGroup = new Group(1, N_LEVELS)
        ratingGroup.addMember(identity.commitment)

        ratingProof = await generateRateCredentialIssuerProof(identity, ratingGroup, 100, "sneed", semaphoreSnarkArtifacts)
        ratingGroup.addMember(altIdentity.commitment)
        altRatingProof = await generateRateCredentialIssuerProof(altIdentity, ratingGroup, 15, "chuck", semaphoreSnarkArtifacts)
    })

    beforeEach(async () => {
        const { credentials } = await run("deploy:credentials", {
            logs: false
        })

        credentialsContract = credentials
    })

    context("without created tests", () => {
        describe("createTest", () => {
            context("when the time limit given is in the past", () => {
                it("reverts for `timeLimit` > 0", async () => {
                    await expect(
                        credentialsContract.createTest(50, 50, 3, 1, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TimeLimitIsInThePast"
                    )
                })

                it("creates a new test for `timeLimit` = 0", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                })
            })

            context("when the number of questions given is invalid", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.createTest(50, 50, 0, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidNumberOfQuestions"
                    )
                    
                    await expect(
                        credentialsContract.createTest(50, 50, 65, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidNumberOfQuestions"
                    )
                })
            })

            context("when the minimum grade given is over 100", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.createTest(101, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidMinimumGrade"
                    )  
                })
            })

            context("when the multiple choice weight given is over 100", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.createTest(50, 101, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidMultipleChoiceWeight"
                    )
                })
            })
            
            context("after creating tests", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                })

                it("emits a `TestCreated` event", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "TestCreated")
                        .withArgs('1')
                })

                it("increases the `nTests` variable", async () => {
                    expect(
                        await credentialsContract.nTests()
                    ).to.be.equal('1')
                })
            })
        })

        describe("verifyTestAnswers", () => {
            context("when attempting to verify a test that doesn't exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.verifyTestAnswers(1, testVariables.openAnswersHashes)
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
                        credentialsContract.invalidateTest(1)
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
                            1, 
                            passingProof.proof, 
                            [
                                passingProof.identityCommitment, 
                                passingProof.newIdentityTreeRoot,
                                passingProof.gradeCommitment,
                                passingProof.newGradeTreeRoot
                            ], 
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
                    await credentialsContract.createTest(50, 50, 3, currentTimestamp + 1, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    time.setNextBlockTimestamp(currentTimestamp + 101)
                    mine()

                    await expect(
                        credentialsContract.solveTest(
                            1, 
                            passingProof.proof,
                            [
                                passingProof.identityCommitment, 
                                passingProof.newIdentityTreeRoot,
                                passingProof.gradeCommitment,
                                passingProof.newGradeTreeRoot
                            ], 
                            true
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TimeLimitReached"
                    )
                })
            })
        })

        describe("rateIssuer", () => {
            context("when attempting to give a rating for a test that does not exist", () => {
                it("reverts", async () => {
                    const group = new Group(1, N_LEVELS)
                    group.addMembers([BigInt(1), BigInt(2), identity.commitment])

                    const ratingProof = await generateRateCredentialIssuerProof(
                        identity,
                        group,
                        100,
                        "sneed",
                        {
                            wasmFilePath: '../lib/snark-artifacts/semaphore.wasm',
                            zkeyFilePath: `../lib/snark-artifacts/semaphore.zkey`
                        }
                    )

                    await expect(
                        credentialsContract.rateIssuer(
                            1,
                            100,
                            "sneed",
                            ratingProof.semaphoreFullProof.proof,
                            [group.root, ratingProof.semaphoreFullProof.nullifierHash]
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })
        })

        describe("getTestAverageRating", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getTestAverageRating(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })
        })

        describe("getTest", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getTest(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `Test` struct", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect((await credentialsContract.getTest(1)).slice(0,12).map( n => { return n.toString() }))
                        .to.deep.equal([50, 50, 3, 0, 0, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters])
                })
            })
        })

        describe("getTestURI", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getTestURI(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding testURI", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getTestURI(1))
                        .to.be.equal(testURI)
                })
            })
        })

        describe("getMultipleChoiceRoot", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getMultipleChoiceRoot(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `multipleChoiceRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getMultipleChoiceRoot(1))
                        .to.be.equal(testVariables.multipleChoiceRoot)
                })
            })
        })

        describe("getOpenAnswersHashesRoot", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getopenAnswersHashesRoot(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `openAnswersRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getopenAnswersHashesRoot(1))
                        .to.be.equal(testVariables.openAnswersHashesRoot)
                })
            })
        })

        describe("getOpenAnswersHashes", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getOpenAnswersHashes(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns an empty array", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getOpenAnswersHashes(1))
                        .to.deep.equal([])
                })
            })
        })

        describe("getTestRoot", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getTestRoot(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `testRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getTestRoot(1))
                        .to.be.equal(testRoot)
                })
            })
        })

        describe("getTestParameters", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getTestParameters(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `testParameters`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getTestParameters(1))
                        .to.be.equal(testParameters)
                })
            })
        })

        describe("getNonPassingTestParameters", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getNonPassingTestParameters(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `testParameters`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.getNonPassingTestParameters(1))
                        .to.be.equal(nonPassingTestParameters)
                })

                it("returns the same `testParameters` as getTestParameters when the `minimumGrade` was set to zero", async () => {
                    await credentialsContract.createTest(0, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 
                    
                    expect(await credentialsContract.getTestParameters(1))
                        .to.be.equal(nonPassingTestParameters)
                    expect(await credentialsContract.getNonPassingTestParameters(1))
                        .to.be.equal(nonPassingTestParameters)
                })
            })
        })

        describe("getMerkleRootCreationDate", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getMerkleRootCreationDate(1, credentialsGroup.root)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test and without it getting solved", () => {
                it("reverts", async() => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    await expect(
                        credentialsContract.getMerkleRootCreationDate(1, credentialsGroup.root)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "MerkleTreeRootIsNotPartOfTheGroup"
                    )
                })
            })

            context("after creating a test and after it gets solved", () => {
                it("returns the correct creation date", async() => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    await credentialsContract.solveTest(
                        1, 
                        passingProof.proof,
                        [
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot
                        ], 
                        true
                    )

                    credentialsGroup.updateMember(0, identity.commitment)

                    expect(
                        await credentialsContract.getMerkleRootCreationDate(1, credentialsGroup.root)
                    ).to.be.equal((await ethers.provider.getBlock("latest")).timestamp)
                })
            })
        })

        describe("wasNullifierHashUsed", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.wasNullifierHashUsed(1, ratingProof.semaphoreFullProof.nullifierHash)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test and without the nullifiers getting used", () => {
                it("returns false", async() => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(
                        await credentialsContract.wasNullifierHashUsed(1, ratingProof.semaphoreFullProof.nullifierHash)
                    ).to.be.equal(false)
                })
            })

            context("after creating a test and after a nullifier is used", () => {
                it("returns true", async() => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    await credentialsContract.solveTest(
                        1, 
                        passingProof.proof,
                        [
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot
                        ], 
                        true
                    )

                    await credentialsContract.rateIssuer(
                        1, 
                        ratingProof.rating, 
                        ratingProof.comment, 
                        ratingProof.semaphoreFullProof.proof,
                        [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash], 
                    )

                    expect(
                        await credentialsContract.wasNullifierHashUsed(1, ratingProof.semaphoreFullProof.nullifierHash)
                    ).to.be.equal(true)
                })
            })
        })

        describe("testExists", () => {
            context("when the `testId` given is 0", () => {
                it("returns false", async () => {
                    expect(
                        await credentialsContract.testExists(0)
                    ).to.be.equal(false)
                })
            })

            context("when the `testId` given does not exist", () => {
                it("returns false", async () => {
                    expect(
                        await credentialsContract.testExists(1)
                    ).to.be.equal(false)
                })
            })

            context("after creating a test", () => {
                it("returns true", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.testExists(1))
                        .to.be.equal(true)
                })
            })
        })

        describe("testIsValid", () => {
            context("when the `testId` given does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.testIsValid(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )               
                })
            })

            context("after creating a test", () => {
                it("returns true", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    expect(await credentialsContract.testIsValid(1))
                        .to.be.equal(true)
                })
            })
        })

        describe("getMerkleTreeRoot", () => {
            context("when the `groupId` given corresponds to a test that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getMerkleTreeRoot(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns the corresponding `merkleTreeRoot`", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    const emptyRoot = (new Group(1, N_LEVELS)).root

                    // Grade tree group
                    expect(await credentialsContract.getMerkleTreeRoot(1))
                        .to.be.equal(emptyRoot)
                    // Credentials tree group  
                    expect(await credentialsContract.getMerkleTreeRoot(2))
                        .to.be.equal(emptyRoot)  
                    // No credentials tree group
                    expect(await credentialsContract.getMerkleTreeRoot(3))
                        .to.be.equal(emptyRoot)  
                })
            })
        })

        describe("getMerkleTreeDepth", () => {
            it(`returns the default \`TREE_DEPTH\` set at ${N_LEVELS}`, async () => {
                expect(await credentialsContract.getMerkleTreeDepth(1))
                    .to.be.equal(N_LEVELS) 
            })
        })

        describe("getNumberOfMerkleTreeLeaves", () => {
            context("when the `groupId` given corresponds to a test that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.getNumberOfMerkleTreeLeaves(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "TestDoesNotExist"
                    )
                })
            })

            context("after creating a test", () => {
                it("returns 0", async () => {
                    await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI) 

                    // Grade tree group
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(1))
                        .to.be.equal(0)
                    // Credentials tree group  
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(2))
                        .to.be.equal(0)  
                    // No credentials tree group
                    expect(await credentialsContract.getNumberOfMerkleTreeLeaves(3))
                        .to.be.equal(0)
                })
            })
        })
    })

    context("with created tests", () => {
        beforeEach(async () => {
            await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
        })

        describe("createTest", () => {
            context("after creating tests", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsContract.createTest(50, 50, 3, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                })

                it("procedurally increases the `nTests` variable", async () => {
                    expect(
                        await credentialsContract.nTests()
                    ).to.be.equal('2')
                })

                it("emits a `TestCreated` event", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "TestCreated")
                        .withArgs('2')
                })
            })
        })

        describe("verifyTestAnswers", () => {
            context("when being called by someone other than the admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.connect(signers[1]).verifyTestAnswers(1, openAnswersHashes)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "CallerIsNotTheTestAdmin"
                    )
                })
            })

            context("when providing an invalid number of answer hashes", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.verifyTestAnswers(1, [])
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
                    await credentialsContract.verifyTestAnswers(1, openAnswersHashes.slice(0,3))  
                })

                describe("getOpenAnswersHashes", () => {
                    it("returns the corresponding list of open answer hashes", async () => {
                        expect(await credentialsContract.getOpenAnswersHashes(1))
                            .to.deep.equal(openAnswersHashes.slice(0,3))
                    })
                })

                describe("verifyTestAnswers", () => {
                    it("reverts when trying to verify an already verified test", async () => {
                        await expect(
                            credentialsContract.verifyTestAnswers(1, [])
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestAnswersAlreadyVerified"
                        )
                    })
                })
            })
        })

        describe("invalidateTest", () => {
            context("when being called by someone other than the admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.connect(signers[1]).invalidateTest(1)
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "CallerIsNotTheTestAdmin"
                    )
                })
            })

            context("when being called by the admin", () => {
                it("emits a `TestInvalidated` event", async () => {
                    const tx = await credentialsContract.invalidateTest(1)

                    await expect(tx)
                        .to.emit(credentialsContract, "TestInvalidated")
                        .withArgs(1)
                })
            })

            context("after invalidating a test", () => {
                beforeEach(async () => {
                    await credentialsContract.invalidateTest(1)
                })

                describe("testIsValid", () => {
                    it("returns false", async () => {
                        expect(await credentialsContract.testIsValid(1))
                            .to.be.equal(false)
                    })
                })

                describe("getTest", () => {
                    it("shows the minimum grade to be 255 as part of the `Test` struct", async () => {
                        expect((await credentialsContract.getTest(1)).slice(0,12).map( n => { return n.toString() }))
                        .to.deep.equal([255, 50, 3, 0, 0, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters])
                    })
                })

                describe("invalidateTest", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.invalidateTest(1)
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
                                1, 
                                passingProof.proof,
                                [
                                    passingProof.identityCommitment, 
                                    passingProof.newIdentityTreeRoot,
                                    passingProof.gradeCommitment,
                                    passingProof.newGradeTreeRoot
                                ], 
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
                            1, 
                            bogusProof,
                            [
                                passingProof.identityCommitment, 
                                passingProof.newIdentityTreeRoot,
                                passingProof.gradeCommitment,
                                passingProof.newGradeTreeRoot
                            ], 
                            true
                        )
                    ).to.revertedWithoutReason
                })
            })

            context("when setting `testPassed` to true", () => {
                context("after a successful call", () => {
                    let tx;

                    beforeEach(async () => {
                        tx = await credentialsContract.solveTest(
                            1, 
                            passingProof.proof,
                            [
                                passingProof.identityCommitment, 
                                passingProof.newIdentityTreeRoot,
                                passingProof.gradeCommitment,
                                passingProof.newGradeTreeRoot
                            ], 
                            true
                        )                        

                        credentialsGroup.updateMember(0, identity.commitment)
                        gradeGroup.updateMember(0, passingGradeCommitment)
                    })

                    it("increases the `credentialsTreeIndex` by one", async () => {
                        expect((await credentialsContract.getNumberOfMerkleTreeLeaves(2)))
                            .to.equal(1)
                    })
    
                    it("updates the `credentialsTreeRoot`", async () => {
                        expect((await credentialsContract.getMerkleTreeRoot(2)))
                            .to.equal(credentialsGroup.root)
                    })
    
                    it("emits a `MemberAdded` event for the credentials tree group", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "MemberAdded")
                            .withArgs(2, 0, identity.commitment, credentialsGroup.root)
                    })

                    it("emits a `CredentialsGained` event", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "CredentialsGained")
                            .withArgs(1, identity.commitment, passingGradeCommitment)
                    })
                })
            })

            context("when setting `testPassed` to false", () => {
                context("after a successful call", () => {
                    let tx;

                    beforeEach(async () => {
                        tx = await credentialsContract.solveTest(
                            1, 
                            nonPassingProof.proof,
                            [
                                nonPassingProof.identityCommitment, 
                                nonPassingProof.newIdentityTreeRoot,
                                nonPassingProof.gradeCommitment,
                                nonPassingProof.newGradeTreeRoot
                            ], 
                            false
                        )
                        
                        noCredentialsGroup.updateMember(0, identity.commitment)
                        gradeGroup.updateMember(0, passingGradeCommitment)
                    })

                    it("increases the `noCredentialsTreeIndex` by one", async () => {
                        expect((await credentialsContract.getNumberOfMerkleTreeLeaves(3)))
                            .to.equal(noCredentialsGroup.members.length)
                    })
    
                    it("updates the `noCredentialsTreeRoot`", async () => {
                        expect((await credentialsContract.getMerkleTreeRoot(3)))
                            .to.equal(noCredentialsGroup.root)
                    })
    
                    it("emits a `MemberAdded` event for the no credentials tree", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "MemberAdded")
                            .withArgs(3, 0, identity.commitment, noCredentialsGroup.root)
                    })

                    it("emits a `CredentialsNotGained` event", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "CredentialsNotGained")
                            .withArgs(1, identity.commitment, nonPassingGradeCommitment)
                    })
                })
            })

            context("after a successful call", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsContract.solveTest(
                        1,  
                        passingProof.proof,
                        [
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot
                        ], 
                        true
                    )
                    
                    credentialsGroup.updateMember(0, identity.commitment)
                    gradeGroup.updateMember(0, passingGradeCommitment)
                })

                it("increases the `gradeTreeIndex` by one", async () => {
                    expect((await credentialsContract.getNumberOfMerkleTreeLeaves(1)))
                        .to.equal(1)
                })

                it("updates the `gradeTreeRoot`", async () => {
                    expect((await credentialsContract.getMerkleTreeRoot(1)))
                        .to.equal(gradeGroup.root)
                })

                it("emits a `MemberAdded` event for the grade tree group", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "MemberAdded")
                        .withArgs(1, 0, passingGradeCommitment, gradeGroup.root)
                })
            })
        })

        describe("solveCredentialRestrictedTest", () => {
            context("when trying to solve a test that is not credential restricted", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.solveCredentialRestrictedTest(
                            1,
                            [1, 2, 3, 4, 5, 6, 7, 8],
                            [1, 2, 3, 4],
                            [1, 2, 3, 4, 5, 6, 7, 8],
                            [1, 2],
                            true
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "CredentialOwnershipProofNotNeeded"
                    )
                })
            })
        })

        describe("solveGradeRestrictedTest", () => {
            context("when trying to solve a test that is not grade restricted", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.solveGradeRestrictedTest(
                            1,
                            [1, 2, 3, 4, 5, 6, 7, 8],
                            [1, 2, 3, 4],
                            [1, 2, 3, 4, 5, 6, 7, 8],
                            [1, 2],
                            true
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "GradeThresholdProofNotNeeded"
                    )
                })
            })
        })

        describe("rateIssuer", () => {

            beforeEach(async () => {
                await credentialsContract.solveTest(
                    1, 
                    passingProof.proof,
                    [
                        passingProof.identityCommitment, 
                        passingProof.newIdentityTreeRoot,
                        passingProof.gradeCommitment,
                        passingProof.newGradeTreeRoot
                    ], 
                    true
                )
            })

            context("when providing an invalid proof", () => {
                it("reverts", async () => {
                    const bogusProof: Proof = [...ratingProof.semaphoreFullProof.proof]
                    bogusProof[0] = BigInt(passingProof.proof[0]) + BigInt(1)

                    await expect(
                        credentialsContract.rateIssuer(
                            1,
                            ratingProof.rating,
                            ratingProof.comment,
                            bogusProof,
                            [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                        )
                    ).to.revertedWithoutReason
                })
            })

            context("when providing an invalid rating", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsContract.rateIssuer(
                            1,
                            101,
                            ratingProof.comment,
                            ratingProof.semaphoreFullProof.proof,
                            [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "InvalidRating"
                    )
                })
            })

            context("when providing an invalid Merkle root", () => {
                it("reverts", async() => {
                    await expect(
                        credentialsContract.rateIssuer(
                            1,
                            ratingProof.rating,
                            ratingProof.comment,
                            ratingProof.semaphoreFullProof.proof,
                            [1, ratingProof.semaphoreFullProof.nullifierHash],
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "MerkleTreeRootIsNotPartOfTheGroup"
                    )
                })
            })

            context("when providing an expired Merkle root", () => {
                it("reverts", async() => {
                    mine()
                    const currentTimestamp = await time.latest()
                    await credentialsContract.solveTest(
                        1,
                        altPassingProof.proof,
                        [
                            altPassingProof.identityCommitment, 
                            altPassingProof.newIdentityTreeRoot,
                            altPassingProof.gradeCommitment,
                            altPassingProof.newGradeTreeRoot
                        ], 
                        true
                    )
                    time.setNextBlockTimestamp(currentTimestamp + 16*60*60)
                    mine()

                    await credentialsContract.rateIssuer(
                            1,
                            ratingProof.rating,
                            ratingProof.comment,
                            ratingProof.semaphoreFullProof.proof,
                            [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                        )

                    await expect(
                        credentialsContract.rateIssuer(
                            1,
                            ratingProof.rating,
                            ratingProof.comment,
                            ratingProof.semaphoreFullProof.proof,
                            [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "MerkleTreeRootIsExpired"
                    )
                })
            })

            context("when providing a used nullifier", () => {
                it("reverts", async() => {
                    await credentialsContract.rateIssuer(
                        1,
                        ratingProof.rating,
                        ratingProof.comment,
                        ratingProof.semaphoreFullProof.proof,
                        [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                    )

                    await expect(
                        credentialsContract.rateIssuer(
                            1,
                            ratingProof.rating,
                            ratingProof.comment,
                            ratingProof.semaphoreFullProof.proof,
                            [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsContract,
                        "UsingSameNullifierTwice"
                    )
                })
            })

            context("after a successful call", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsContract.rateIssuer(
                        1,
                        ratingProof.rating,
                        ratingProof.comment,
                        ratingProof.semaphoreFullProof.proof,
                        [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                    )
                })

                it("increases the total rating by the rate given", async () => {
                    expect(
                        (await credentialsContract.testRatings(1))[0]
                    ).to.be.equal(ratingProof.rating)
                })

                it("increases the total number of ratings by one", async () => {
                    expect(
                        (await credentialsContract.testRatings(1))[1]
                    ).to.be.equal(1)
                })

                it("emits a `NewRating` event", async () => {
                    await expect(tx)
                        .to.emit(credentialsContract, "NewRating")
                        .withArgs('1', accounts[0], ratingProof.rating, ratingProof.comment)
                })
            })
        })

        describe("getTestAverageRating", () => {
            context("before any ratings are made", () => {
                it("returns 0", async () => {
                    expect(
                        await credentialsContract.getTestAverageRating(1)
                    ).to.be.equal(0)
                })
            })

            context("after making ratings", () => {
                beforeEach(async () => {
                    await credentialsContract.solveTest(
                        1, 
                        passingProof.proof,
                        [
                            passingProof.identityCommitment, 
                            passingProof.newIdentityTreeRoot,
                            passingProof.gradeCommitment,
                            passingProof.newGradeTreeRoot
                        ],
                        true
                    )

                    await credentialsContract.rateIssuer(
                        1,
                        ratingProof.rating,
                        ratingProof.comment,
                        ratingProof.semaphoreFullProof.proof,
                        [ratingProof.semaphoreFullProof.merkleTreeRoot, ratingProof.semaphoreFullProof.nullifierHash],
                    )

                    await credentialsContract.solveTest(
                        1, 
                        altPassingProof.proof, 
                        [
                            altPassingProof.identityCommitment, 
                            altPassingProof.newIdentityTreeRoot,
                            altPassingProof.gradeCommitment,
                            altPassingProof.newGradeTreeRoot
                        ], 
                        true
                    )
    
                    await credentialsContract.rateIssuer(
                        1,
                        altRatingProof.rating,
                        altRatingProof.comment,
                        altRatingProof.semaphoreFullProof.proof,
                        [altRatingProof.semaphoreFullProof.merkleTreeRoot, altRatingProof.semaphoreFullProof.nullifierHash],
                    )
                })

                it("returns the average rating given", async () => {
                    expect(
                        await credentialsContract.getTestAverageRating(1)
                    ).to.be.equal(Math.floor((ratingProof.rating + altRatingProof.rating)/2))
                })
            })
        })

        context("without credential restricted tests created", () => {
            describe("createCredentialRestrictedTest", () => {
                context("when the `requiredCredential` given is 0", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.createCredentialRestrictedTest(50, 50, 3, 0, 0, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestDoesNotExist"
                        )
                    })
                })
    
                context("when the `requiredCredential` given does not exist", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.createCredentialRestrictedTest(50, 50, 3, 0, 2, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestDoesNotExist"
                        )
                    })
                })
    
                context("after creating tests", () => {
                    let tx;
    
                    beforeEach(async () => {
                        tx = await credentialsContract.createCredentialRestrictedTest(50, 50, 3, 0, 1, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    })
    
                    it("increases the `nTests` variable", async () => {
                        expect(
                            await credentialsContract.nTests()
                        ).to.be.equal('2')
                    })
    
                    it("emits a `TestCreated` event", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "TestCreated")
                            .withArgs('2')
                    })
                })
            })
        })

        context("with credential restricted tests created", () => {
            beforeEach(async () => {
                await credentialsContract.createCredentialRestrictedTest(50, 50, 3, 0, 1, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                await credentialsContract.solveTest(
                    1, 
                    passingProof.proof,
                    [
                        passingProof.identityCommitment, 
                        passingProof.newIdentityTreeRoot,
                        passingProof.gradeCommitment,
                        passingProof.newGradeTreeRoot
                    ],
                    true
                )
            })
    
            describe("solveTest", () => {
                context("when trying to solve a test that is credential restricted", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.solveTest(
                                2,
                                [1, 2, 3, 4, 5, 6, 7, 8],
                                [1, 2, 3, 4],
                                true
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "UserMustProveCredentialOwnership"
                        ).withArgs(
                            '1'
                        )
                    })
                })
            })
    
            describe("solveCredentialRestrictedTest", () => {
                let credentialRestrictedTestProof: CredentialRestrictedTestFullProof;

                let restrictedCredentialsGroup = new Group(2, N_LEVELS);
                let restrictedGradeGroup = new Group(2, N_LEVELS);
                let requiredCredentialsGroup = new Group(1, N_LEVELS);

                before(async () => {
                    requiredCredentialsGroup.addMember(identity.commitment)
                    
                    credentialRestrictedTestProof = await generateCredentialRestrictedTestProof(
                        identity,
                        testAnswers,
                        testVariables,
                        restrictedCredentialsGroup,
                        restrictedGradeGroup,
                        requiredCredentialsGroup,
                        testSnarkArtifacts,
                        semaphoreSnarkArtifacts
                    )
                })

                beforeEach(async () => {
                    await credentialsContract.solveCredentialRestrictedTest(
                        2,
                        credentialRestrictedTestProof.testFullProof.proof,
                        [
                            credentialRestrictedTestProof.testFullProof.identityCommitment, 
                            credentialRestrictedTestProof.testFullProof.newIdentityTreeRoot,
                            credentialRestrictedTestProof.testFullProof.gradeCommitment,
                            credentialRestrictedTestProof.testFullProof.newGradeTreeRoot
                        ],
                        credentialRestrictedTestProof.semaphoreFullProof.proof,
                        [
                            credentialRestrictedTestProof.semaphoreFullProof.merkleTreeRoot,
                            credentialRestrictedTestProof.semaphoreFullProof.nullifierHash  // used nullifier
                        ],
                        true
                    )
                })

                context("when providing a used nullifier", () => {
                    it("reverts", async() => {
                        await expect(
                            credentialsContract.solveCredentialRestrictedTest(
                                2,
                                credentialRestrictedTestProof.testFullProof.proof,
                                [
                                    credentialRestrictedTestProof.testFullProof.identityCommitment, 
                                    credentialRestrictedTestProof.testFullProof.newIdentityTreeRoot,
                                    credentialRestrictedTestProof.testFullProof.gradeCommitment,
                                    credentialRestrictedTestProof.testFullProof.newGradeTreeRoot
                                ],
                                credentialRestrictedTestProof.semaphoreFullProof.proof,
                                [
                                    credentialRestrictedTestProof.semaphoreFullProof.merkleTreeRoot,
                                    credentialRestrictedTestProof.semaphoreFullProof.nullifierHash  // used nullifier
                                ],
                                true
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "UsingSameNullifierTwice"
                        )
                    })
                })
    
                context("after a successful call", () => {
                    it("voids the nullifier used", async() => {
                        expect(
                            await credentialsContract.wasNullifierHashUsed(1, credentialRestrictedTestProof.semaphoreFullProof.nullifierHash)
                        ).to.be.equal(true)
                    })
                })
            })
    
            describe("solveGradeRestrictedTest", () => {
                context("when trying to solve a test that is credential restricted", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.solveGradeRestrictedTest(
                                2,
                                [1, 2, 3, 4, 5, 6, 7, 8],
                                [1, 2, 3, 4],
                                [1, 2, 3, 4, 5, 6, 7, 8],
                                [1, 2],
                                true
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "UserMustProveCredentialOwnership"
                        ).withArgs(
                            '1'
                        )
                    })
                })
            })
    
            describe("getTest", () => {
                it("returns the corresponding `Test` struct", async () => {
                    expect((await credentialsContract.getTest(1)).slice(0,12).map( n => { return n.toString() }))
                        .to.deep.equal([50, 50, 3, 0, 0, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters])
                })
            })
        })

        context("without grade restricted tests created", () => {
            describe("createGradeRestrictedTest", () => {
                context("when the `requiredCredential` given is 0", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.createGradeRestrictedTest(50, 50, 3, 0, 0, requiredGradeThreshold, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestDoesNotExist"
                        )
                    })
                })
    
                context("when the `requiredCredential` given does not exist", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.createGradeRestrictedTest(50, 50, 3, 0, 2, requiredGradeThreshold, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "TestDoesNotExist"
                        )
                    })
                })
    
                context("when the `requiredGradeThreshold` is greater than 100", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.createGradeRestrictedTest(50, 50, 3, 0, 1, 101, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "InvalidRequiredGradeThreshold"
                        )
                    })
                })
    
                context("after creating tests", () => {
                    let tx;
    
                    beforeEach(async () => {
                        tx = await credentialsContract.createGradeRestrictedTest(50, 50, 3, 0, 1, requiredGradeThreshold, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                    })
    
                    it("increases the `nTests` variable", async () => {
                        expect(
                            await credentialsContract.nTests()
                        ).to.be.equal('2')
                    })
    
                    it("emits a `TestCreated` event", async () => {
                        await expect(tx)
                            .to.emit(credentialsContract, "TestCreated")
                            .withArgs('2')
                    })
                })
            })
        })

        context("with grade restricted tests created", () => {
            beforeEach(async () => {
                await credentialsContract.createGradeRestrictedTest(50, 50, 3, 0, 1, requiredGradeThreshold, testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testURI)
                await credentialsContract.solveTest(
                    1, 
                    passingProof.proof,
                    [
                        passingProof.identityCommitment, 
                        passingProof.newIdentityTreeRoot,
                        passingProof.gradeCommitment,
                        passingProof.newGradeTreeRoot
                    ],
                    true
                )
            })
    
            describe("solveTest", () => {
                context("when trying to solve a test that is grade restricted", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.solveTest(
                                2,
                                [1, 2, 3, 4, 5, 6, 7, 8],
                                [1, 2, 3, 4],
                                true
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "UserMustProveGradeThresholdObtained"
                        ).withArgs(
                            '1', requiredGradeThreshold
                        )
                    })
                })
            })
            
            describe("solveCredentialRestrictedTest", () => {
                context("when trying to solve a test that is grade restricted", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsContract.solveCredentialRestrictedTest(
                                2,
                                [1, 2, 3, 4, 5, 6, 7, 8],
                                [1, 2, 3, 4],
                                [1, 2, 3, 4, 5, 6, 7, 8],
                                [1, 2],
                                true
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "UserMustProveGradeThresholdObtained"
                        ).withArgs(
                            '1', requiredGradeThreshold
                        )
                    })
                })
            })
    
            describe("solveGradeRestrictedTest", () => {
                let gradeRestrictedTestProof: GradeRestrictedTestFullProof;

                let restrictedCredentialsGroup = new Group(2, N_LEVELS);
                let restrictedGradeGroup = new Group(2, N_LEVELS);
                let gradeClaimGroup = new Group(1, N_LEVELS)

                before(async () => {
                    gradeClaimGroup.addMember(passingProof.gradeCommitment)

                    gradeRestrictedTestProof = await generateGradeRestrictedTestProof(
                        identity,
                        testAnswers,
                        testVariables,
                        restrictedCredentialsGroup,
                        restrictedGradeGroup,
                        gradeClaimGroup,
                        requiredGradeThreshold,
                        { multipleChoiceWeight: 50, nQuestions: 3 },
                        testSnarkArtifacts,
                        gradeClaimSnarkArtifacts
                    )
                })

                beforeEach(async () => {
                    await credentialsContract.solveGradeRestrictedTest(
                        2,
                        gradeRestrictedTestProof.testFullProof.proof,
                        [
                            gradeRestrictedTestProof.testFullProof.identityCommitment, 
                            gradeRestrictedTestProof.testFullProof.newIdentityTreeRoot,
                            gradeRestrictedTestProof.testFullProof.gradeCommitment,
                            gradeRestrictedTestProof.testFullProof.newGradeTreeRoot
                        ],
                        gradeRestrictedTestProof.gradeClaimFullProof.proof,
                        [
                            gradeRestrictedTestProof.gradeClaimFullProof.gradeTreeRoot,
                            gradeRestrictedTestProof.gradeClaimFullProof.nullifierHash 
                        ],
                        true
                    )
                })

                context("when providing a used nullifier", () => {
                    it("reverts", async() => {
                        await expect(
                            credentialsContract.solveGradeRestrictedTest(
                                2,
                                gradeRestrictedTestProof.testFullProof.proof,
                                [
                                    gradeRestrictedTestProof.testFullProof.identityCommitment, 
                                    gradeRestrictedTestProof.testFullProof.newIdentityTreeRoot,
                                    gradeRestrictedTestProof.testFullProof.gradeCommitment,
                                    gradeRestrictedTestProof.testFullProof.newGradeTreeRoot
                                ],
                                gradeRestrictedTestProof.gradeClaimFullProof.proof,
                                [
                                    gradeRestrictedTestProof.gradeClaimFullProof.gradeTreeRoot,
                                    gradeRestrictedTestProof.gradeClaimFullProof.nullifierHash  // used nullifier
                                ],
                                true
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsContract,
                            "UsingSameNullifierTwice"
                        )
                    })
                })
    
                context("after a successful call", () => {
                    it("voids the nullifier used", async() => {
                        expect(
                            await credentialsContract.wasNullifierHashUsed(1, gradeRestrictedTestProof.gradeClaimFullProof.nullifierHash)
                        ).to.be.equal(true)
                    })
                })
            })
    
            describe("getTest", () => {
                it("returns the corresponding `Test` struct", async () => {
                    expect((await credentialsContract.getTest(1)).slice(0,12).map( n => { return n.toString() }))
                        .to.deep.equal([50, 50, 3, 0, 0, 0, accounts[0], testVariables.multipleChoiceRoot, testVariables.openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters])
                })
            })
        })
    })
    // TREE GOT FULL: the passingProof would revert, as the index inside the smart contract would be set to 2**N_LEVELS, whereas the max index the circuit can output is 2**N_LEVELS - 1
})
