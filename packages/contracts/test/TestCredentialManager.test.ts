import { 
    buildPoseidon,
    encodeTestInitializingParameters,
    encodeTestFullProof,
    encodeCredentialRestrictedTestFullProof,
    encodeGradeRestrictedTestFullProof,
    generateCredentialRestrictedTestProof,
    generateGradeRestrictedTestProof,
    generateOpenAnswers, 
    generateTestProof, 
    hash,
    rootFromLeafArray,  
    BigNumberish,
    CredentialRestrictedTestFullProof,
    GradeRestrictedTestFullProof,
    Poseidon, 
    TestAnswers, 
    TestFullProof,
    TestVariables, 
    MAX_TREE_DEPTH, 
    TEST_HEIGHT,
    GradeClaimFullProof,
    generateGradeClaimProof,
    MAX_GRADE
} from "@bq2/lib"
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, FullProof } from '@semaphore-protocol/proof';
import { expect } from "chai";
import { Signer } from "ethers"
import { ethers, run } from "hardhat";
import { describe } from "mocha";
import { 
    CredentialsRegistry, 
    TestCredentialManager, 
    TestVerifier,
    TestVerifier__factory,
    GradeClaimVerifier,
    GradeClaimVerifier__factory,
    Pairing,
    Pairing__factory
} from "../typechain-types"

const TREE_DEPTH = 16

describe("TestCredentialManager contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity;
    let altIdentity: Identity;

    let credentialURI = 'https://twitter.com/0xdeenz';
    
    let openAnswersHashes: BigNumberish[];
    let testRoot: BigNumberish;
    let testParameters: BigNumberish;
    let nonPassingTestParameters: BigNumberish;

    let gradeGroup = new Group(1, TREE_DEPTH);
    let credentialsGroup = new Group(1, TREE_DEPTH);

    let minimumGrade = 50;
    let multipleChoiceWeight = 50;
    let nQuestions = 3;
    let multipleChoiceRoot: string;
    let openAnswersHashesRoot: string;
    const gradeThreshold = 80;

    let testAnswers: TestAnswers;
    let testVariables: TestVariables;

    let externalNullifier = 350;
    let signal = ethers.utils.formatBytes32String("I need bout tree fiddy");

    let credentialsRegistry: CredentialsRegistry;
    let testCredentialManager: TestCredentialManager;
    let testVerifier: TestVerifier;
    let gradeClaimVerifier: GradeClaimVerifier;
    let pairing: Pairing;

    let invalidCredentialManagerAddress: string;
    let mockCredentialManagerAddress: string;

    let encodedTestCredentialData: string;
    let encodedTestFullProof: string;
    let encodedAltTestFullProof: string;

    let signers: Signer[];
    let accounts: string[];

    let testProof: TestFullProof;
    let altTestProof: TestFullProof;
    let nonPassingProof: TestFullProof;

    let credentialOwnershipProof: FullProof;
    let gradeClaimProof: GradeClaimFullProof;

    const gradeClaimSnarkArtifacts = {
        wasmFilePath: '../snark-artifacts/gradeClaim.wasm',
        zkeyFilePath: `../snark-artifacts/gradeClaim.zkey`
    }
    
    const semaphoreSnarkArtifacts = {
        wasmFilePath: '../snark-artifacts/semaphore.wasm',
        zkeyFilePath: `../snark-artifacts/semaphore.zkey`
    };

    const testSnarkArtifacts = {
        wasmFilePath: "../snark-artifacts/test.wasm",
        zkeyFilePath: "../snark-artifacts/test.zkey"
    };

    const abi = ethers.utils.defaultAbiCoder

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

        multipleChoiceRoot = rootFromLeafArray(poseidon, Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1)).toString()
        openAnswersHashesRoot = rootFromLeafArray(poseidon, openAnswersHashes).toString()

        const multipleChoiceAnswers = Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1)
        const openAnswers = generateOpenAnswers(["sneed's", "feed", "seed"])

        testAnswers = { multipleChoiceAnswers, openAnswers }

        testVariables = {
            minimumGrade,
            multipleChoiceWeight, 
            nQuestions,
            multipleChoiceRoot,
            openAnswersHashesRoot,
            openAnswersHashes
        }

        testRoot = poseidon([multipleChoiceRoot, openAnswersHashesRoot]).toString()
        testParameters = poseidon([
            testVariables.minimumGrade, 
            testVariables.multipleChoiceWeight, 
            testVariables.nQuestions
        ]).toString()
        nonPassingTestParameters = poseidon([0, testVariables.multipleChoiceWeight, testVariables.nQuestions]).toString()

        testProof = await generateTestProof(
            identity,
            testAnswers,
            testVariables,
            credentialsGroup,
            gradeGroup,
            testSnarkArtifacts
        )

        credentialsGroup.updateMember(0, identity.commitment)
        gradeGroup.updateMember(0, testProof.gradeCommitment)

        altTestProof = await generateTestProof(
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
                openAnswers: generateOpenAnswers([])
            },
            { ...testVariables, minimumGrade: 0 },
            new Group(1, TREE_DEPTH),
            new Group(1, TREE_DEPTH),
            testSnarkArtifacts
        )

        encodedTestCredentialData = encodeTestInitializingParameters(
            minimumGrade,
            multipleChoiceWeight,
            nQuestions,
            0,
            accounts[0],
            0,
            0,
            multipleChoiceRoot,
            openAnswersHashesRoot
        )

        encodedTestFullProof = encodeTestFullProof(testProof, true)
        encodedAltTestFullProof = encodeTestFullProof(altTestProof, true)

        credentialOwnershipProof = await generateProof(identity, credentialsGroup, externalNullifier, signal, semaphoreSnarkArtifacts)
        gradeClaimProof = await generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, testVariables, gradeClaimSnarkArtifacts)
        
        const InvalidCredentialManagerFactory = await ethers.getContractFactory("InvalidCredentialManager")
        const invalidCredentialManager = await InvalidCredentialManagerFactory.deploy()
        await invalidCredentialManager.deployed()

        invalidCredentialManagerAddress = invalidCredentialManager.address

        const MockCredentialManagerFactory = await ethers.getContractFactory("MockCredentialManager")
        const mockCredentialManager = await MockCredentialManagerFactory.deploy()
        await mockCredentialManager.deployed()

        mockCredentialManagerAddress = mockCredentialManager.address
    })

    beforeEach(async () => {
        const { registry, testManager, testVerifierAddress, gradeClaimVerifierAddress, pairingAddress } = await run("deploy:credentials-registry", {
            logs: false, 
            connectTestManager: true
        })

        credentialsRegistry = registry
        testCredentialManager = testManager
        testVerifier = TestVerifier__factory.connect(testVerifierAddress, signers[0])
        gradeClaimVerifier = GradeClaimVerifier__factory.connect(gradeClaimVerifierAddress, signers[0])
        pairing = Pairing__factory.connect(pairingAddress, signers[0])

        await credentialsRegistry.defineCredentialType(2, mockCredentialManagerAddress)
    })

    describe("supportsInterface", () => {
        context("when specified a non supported interface", () => {
            it("returns false", async () => {
                expect(await testCredentialManager.supportsInterface(
                    "0xabababab"
                )).to.be.equal(false)
            })
        })
        
        context("when specified a supported interface", () => {
            it("returns true", async () => {
                expect(await testCredentialManager.supportsInterface(
                    "0xf0f36c2a"
                )).to.be.equal(true)
            })
        })
    })

    context("without created test credentials", () => {
        describe("createCredential", () => {
            context("when being called directly and not through the registry", async () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.createCredential(
                            1,
                            encodedTestCredentialData
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CallerIsNotTheCredentialsRegistry"
                    )
                })
            })

            context("when the required credential specified is the new credential", () => {
                it("reverts", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        1,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CannotRequireSameCredential"
                    )
                })
            })

            context("when the required credential specified does not exist", () => {
                it("reverts", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        2,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when the grade threshold is specified but not the required credential", () => {
                it("reverts", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        0,
                        100,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "GradeRestrictedTestsMustSpecifyRequiredCredential"
                    )
                })
            })

            context("when the time limit specified is in the past", () => {
                it("reverts for `timeLimit` > 0", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        1,
                        accounts[0],
                        0,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TimeLimitIsInThePast"
                    )
                })

                it("creates a new credential for `timeLimit` = 0", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        0,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )   

                    // tx clears
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        1,
                        0,
                        testData,
                        credentialURI
                    )
                })
            })

            context("when the number of questions specified is invalid", () => {
                it("reverts", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        2 ** TEST_HEIGHT + 1,
                        0,
                        accounts[0],
                        0,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "InvalidNumberOfQuestions"
                    )
                })
            })

            context("when the minimum grade specified is over the maximum", () => {
                it("reverts", async () => {
                    const testData = encodeTestInitializingParameters(
                        MAX_GRADE + 1,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        0,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "InvalidMinimumGrade"
                    )
                })
            })

            context("when the multiple choice weight specified is invalid", () => {
                it("reverts", async () => {
                    const testData = encodeTestInitializingParameters(
                        minimumGrade,
                        101,
                        nQuestions,
                        0,
                        accounts[0],
                        0,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH,
                            1,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "InvalidMultipleChoiceWeight"
                    )
                })
            })
        })

        describe("updateCredential", () => {
            context("when being called directly and not through the registry", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.updateCredential(
                            1, 
                            { credentialsTreeIndex: 0, noCredentialsTreeIndex: 0, gradeTreeIndex: 0, gradeTreeRoot: 0, credentialsTreeRoot: 0, noCredentialsTreeRoot: 0},
                            '0x00'
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CallerIsNotTheCredentialsRegistry"
                    )
                })
            })
        })  

        describe("verifyTestCredentialAnswers", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.verifyTestCredentialAnswers(
                            1,
                            []
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )

                    await expect(
                        testCredentialManager.verifyTestCredentialAnswers(
                            1,
                            []
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialData", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.getCredentialData(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )

                    await expect(
                        testCredentialManager.getCredentialData(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialAdmin", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    it("reverts", async () => {
                        await expect(
                            testCredentialManager.getCredentialAdmin(
                                1,
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsRegistry,
                            "CredentialDoesNotExist"
                        )
                    })
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )

                    await expect(
                        testCredentialManager.getCredentialAdmin(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("credentialIsValid", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.credentialIsValid(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )

                    await expect(
                        testCredentialManager.credentialIsValid(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("credentialExists", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.credentialExists(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )
                    
                    await expect(
                        testCredentialManager.credentialExists(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("invalidateCredential", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.invalidateCredential(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )
                    
                    await expect(
                        testCredentialManager.invalidateCredential(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getOpenAnswersHashes", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.getOpenAnswersHashes(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a test credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )
                    
                    await expect(
                        testCredentialManager.getOpenAnswersHashes(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialDoesNotExist"
                    )
                })
            })
        })
    })

    context("with created test credentials", () => {
        beforeEach(async () => {
            await credentialsRegistry.createCredential(TREE_DEPTH, 1, 15 * 60, encodedTestCredentialData, credentialURI)
        })

        describe("updateCredential", () => {
            describe("tests", () => {
                context("when providing an invalid proof", () => {
                    it("reverts", async () => {
                        const bogusProof = {
                            ...testProof,
                            gradeCommitment: 350
                        } as any

                        const encodedBogusProof = encodeTestFullProof(bogusProof, true)
                        
                        await expect(
                            credentialsRegistry.updateCredential(
                                1, 
                                encodedBogusProof
                            )
                        ).to.be.revertedWithCustomError(
                            testVerifier,
                            "InvalidProof"
                        )
                    })
                })

                context("when setting `testPassed` to true", () => {
                    let tx;

                    beforeEach(async () => {
                        tx = await credentialsRegistry.updateCredential(1, encodedTestFullProof)
                    })

                    context("after a successful call", () => {
                        it("increases the credentials registry `credentialsTreeIndex` by one", async () => {
                            expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(1))
                                .to.be.equal(1)
                            expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(2))
                                .to.be.equal(1)
                            expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(3))
                                .to.be.equal(0)
                        })

                        it("updates the credentials registry `credentialsTreeRoot`", async () => {
                            expect(await credentialsRegistry.getMerkleTreeRoot(1))
                                .to.be.equal(gradeGroup.root)
                            expect(await credentialsRegistry.getMerkleTreeRoot(2))
                                .to.be.equal(credentialsGroup.root)
                            expect(await credentialsRegistry.getMerkleTreeRoot(3))
                                .to.be.equal((new Group(1, TREE_DEPTH)).root)
                        })

                        it("emits a `CredentialsGained` event", async () => {
                            await expect(tx)
                                .to.emit(testCredentialManager, "CredentialsGained")
                                .withArgs(1, testProof.identityCommitment, testProof.gradeCommitment)
                        })
                    })
                })

                context("when setting `testPassed` to false", () => {
                    let tx;

                    beforeEach(async () => {
                        const encodedNonPassingProof = encodeTestFullProof(nonPassingProof, false)

                        tx = await credentialsRegistry.updateCredential(
                            1, 
                            encodedNonPassingProof
                        )
                    })

                    context("after a successful call", () => {
                        it("increases the credentials registry `noCredentialsTreeIndex` by one", async () => {
                            expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(1))
                                .to.be.equal(1)
                            expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(2))
                                .to.be.equal(0)
                            expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(3))
                                .to.be.equal(1)
                        })

                        it("updates the credentials registry `noCredentialsTreeRoot`", async () => {
                            const altGradeGroup = new Group(1, TREE_DEPTH)
                            altGradeGroup.addMember(nonPassingProof.gradeCommitment)

                            expect(await credentialsRegistry.getMerkleTreeRoot(1))
                                .to.be.equal(altGradeGroup.root)
                            expect(await credentialsRegistry.getMerkleTreeRoot(2))
                                .to.be.equal((new Group(1, TREE_DEPTH)).root)
                            expect(await credentialsRegistry.getMerkleTreeRoot(3))
                                .to.be.equal(credentialsGroup.root)
                        })

                        it("emits a `CredentialsNotGained` event", async () => {
                            await expect(tx)
                                .to.emit(testCredentialManager, "CredentialsNotGained")
                                .withArgs(1, nonPassingProof.identityCommitment, nonPassingProof.gradeCommitment)
                        })
                    })
                })
            })

            describe("credential restricted tests", () => {
                beforeEach(async () => {
                    const encodedCredentialRestrictedTestData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        1,
                        0,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        1,
                        0,
                        encodedCredentialRestrictedTestData,
                        credentialURI
                    )

                    await credentialsRegistry.updateCredential(1, encodedTestFullProof)
                })

                context("when providing incomplete credentialUpdate bytes", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsRegistry.updateCredential(
                                2,
                                encodedTestFullProof
                            )
                        ).to.be.revertedWithoutReason
                    })
                })

                context("when providing an invalid credential ownership proof", () => {
                    it("reverts", async () => {
                        const bogusProof = [...credentialOwnershipProof.proof]
                        bogusProof[0] = 350 as any

                        const bogusFullProof = {
                            ...credentialOwnershipProof,
                            fullProof: bogusProof
                        } as any

                        const encodedCredentialRestrictedProof = encodeCredentialRestrictedTestFullProof(
                            {
                                testFullProof: testProof,
                                semaphoreFullProof: bogusFullProof
                            },
                            true
                        )

                        await expect(
                            credentialsRegistry.updateCredential(
                                2, 
                                encodedCredentialRestrictedProof
                            )
                        ).to.be.revertedWithCustomError(
                            pairing,
                            "InvalidProof"
                        )
                    })
                })

                context("when providing a valid proof", () => {
                    let credentialRestrictedTestProof: CredentialRestrictedTestFullProof;

                    let restrictedCredentialsGroup = new Group(2, TREE_DEPTH);
                    let restrictedGradeGroup = new Group(2, TREE_DEPTH);
                    let requiredCredentialsGroup = new Group(1, TREE_DEPTH);

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

                    it("clears", async () => {
                        const encodedCredentialRestrictedProof = encodeCredentialRestrictedTestFullProof(
                            credentialRestrictedTestProof,
                            true
                        )

                        await credentialsRegistry.updateCredential(
                            2, 
                            encodedCredentialRestrictedProof
                        )
                    })
                })
            })

            describe("grade restricted tests", () => {
                beforeEach(async () => {
                    const encodedGradeRestrictedTestData = encodeTestInitializingParameters(
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        1,
                        gradeThreshold * nQuestions,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await credentialsRegistry.createCredential(
                        MAX_TREE_DEPTH,
                        1,
                        0,
                        encodedGradeRestrictedTestData,
                        credentialURI
                    )

                    await credentialsRegistry.updateCredential(1, encodedTestFullProof)
                })

                context("when providing incomplete credentialUpdate bytes", () => {
                    it("reverts", async () => {
                        await expect(
                            credentialsRegistry.updateCredential(
                                2,
                                encodedTestFullProof
                            )
                        ).to.be.revertedWithoutReason
                    })
                })

                context("when providing an invalid grade claim proof", () => {
                    it("reverts", async () => {
                        const bogusProof = [...gradeClaimProof.proof]
                        bogusProof[0] = 350 as any
                        
                        const fullBogusProof = {
                            ...gradeClaimProof,
                            proof: bogusProof
                        } as any

                        const encodedGradeRestrictedProof = encodeGradeRestrictedTestFullProof(
                            {
                                testFullProof: testProof,
                                gradeClaimFullProof: fullBogusProof
                            },
                            true
                        )

                        await expect(
                            credentialsRegistry.updateCredential(
                                2, 
                                encodedGradeRestrictedProof
                            )
                        ).to.revertedWithoutReason

                        //to.be.revertedWithCustomError(
                        //    gradeClaimVerifier,
                        //    "InvalidProof"
                        //)
                    })
                })

                context("when providing a valid proof", () => {
                    let gradeRestrictedTestProof: GradeRestrictedTestFullProof;

                    let restrictedCredentialsGroup = new Group(2, TREE_DEPTH);
                    let restrictedGradeGroup = new Group(2, TREE_DEPTH);
                    let gradeClaimGroup = new Group(1, TREE_DEPTH)

                    before(async () => {
                        gradeClaimGroup.addMember(testProof.gradeCommitment)

                        gradeRestrictedTestProof = await generateGradeRestrictedTestProof(
                            identity,
                            testAnswers,
                            testVariables,
                            restrictedCredentialsGroup,
                            restrictedGradeGroup,
                            gradeGroup,
                            gradeThreshold,
                            { multipleChoiceWeight, nQuestions },
                            testSnarkArtifacts,
                            gradeClaimSnarkArtifacts
                        )
                    })

                    it("clears", async () => {
                        const encodedGradeRestrictedProof = encodeGradeRestrictedTestFullProof(
                            gradeRestrictedTestProof,
                            true
                        )

                        await credentialsRegistry.updateCredential(
                            2, 
                            encodedGradeRestrictedProof
                        )
                    })
                })
            })
        })

        describe("verifyTestCredentialAnswers", () => {
            context("when being called by someone that is not the credential admin", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.connect(signers[1]).verifyTestCredentialAnswers(
                            1,
                            []
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CallerIsNotTheCredentialAdmin"
                    )
                })
            })

            context("when providing an invalid number of answer hashes", () => {
                it("reverts", async () => {
                    await expect(
                        testCredentialManager.verifyTestCredentialAnswers(
                            1,
                            [1]
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "InvalidCredentialTestAnswersLength"
                    )
                })
            })

            context("after verifying the answers for a given test", () => {
                beforeEach(async () => {
                    await testCredentialManager.verifyTestCredentialAnswers(1, openAnswersHashes.slice(0,3))
                })

                describe("getOpenAnswersHashes", () => {
                    context("when calling for a verified test credential", () => {
                        it("returns the corresponding list of open answer hashes", async () => {
                            expect(await testCredentialManager.getOpenAnswersHashes(1))
                                .to.deep.equal(openAnswersHashes.slice(0,3))
                        })
                    })
                })

                describe("verifyTestCredentialAnswers", () => {
                    context("when trying to verify an already verified test credential", () => {
                        it("reverts", async () => {
                            await expect(
                                testCredentialManager.verifyTestCredentialAnswers(
                                    1,
                                    openAnswersHashes.slice(0,3)
                                )
                            ).to.be.revertedWithCustomError(
                                testCredentialManager,
                                "CredentialTestAnswersAlreadyVerified"
                            )
                        })
                    })
                })
            })
        })

        describe("getCredentialData", () => {
            it("returns the correct credential data", async () => {
                const credentialData = abi.encode(
                    ["uint8", "uint8", "uint8", "uint32", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
                    [minimumGrade, multipleChoiceWeight, nQuestions, 0, accounts[0], 0, 0, multipleChoiceRoot, openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters]
                )

                expect(await testCredentialManager.getCredentialData(1))
                    .to.be.equal(credentialData)
            })
        })

        describe("getCredentialAdmin", () => {
            it("returns the correct credential admin", async () => {
                expect(await testCredentialManager.getCredentialAdmin(1))
                    .to.be.equal(accounts[0])
            })
        })

        describe("credentialIsValid", () => {
            it("returns true for new test credentials", async () => {
                expect(await testCredentialManager.credentialIsValid(1))
                    .to.be.equal(true)
            })
        })

        describe("credentialExists", () => {
            it("returns true for new test credentials", async () => {
                expect(await testCredentialManager.credentialExists(1))
                    .to.be.equal(true)
            })
        })

        describe("invalidateCredential", () => {
            context("when being called by someone that is not the credential admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.connect(signers[1]).invalidateCredential(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CallerIsNotTheCredentialAdmin"
                    )
                })
            })

            context("when calling for a currently valid credential", () => {
                it("invalidates them", async () => {
                    await credentialsRegistry.invalidateCredential(1)

                    expect(await testCredentialManager.credentialIsValid(1))
                        .to.be.equal(false)
                })
            })

            context("when calling for an invalidated credential", () => {
                it("reverts", async () => {
                    await credentialsRegistry.invalidateCredential(1)

                    await expect(
                        credentialsRegistry.invalidateCredential(1)
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestCredentialWasInvalidated"
                    )
                })
            })
        })

        describe("getOpenAnswersHashes", () => {
            context("when calling for a non verified credential", () => {
                it("returns an empty string", async () => {
                    expect(await testCredentialManager.getOpenAnswersHashes(1))
                        .to.deep.equal([])
                })
            })
        })
    })
})
