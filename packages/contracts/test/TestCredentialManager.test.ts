import { 
    buildPoseidon,
    encodeTestCredential,
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
    GradeClaimFullProof,
    generateGradeClaimProof,
    MAX_GRADE,
    SUPPORTED_TEST_HEIGHTS
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

const TEST_HEIGHT = 4;

describe("TestCredentialManager contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity;
    let altIdentity: Identity;

    let credentialURI = 'https://twitter.com/0xdeenz';
    
    let openAnswersHashes: BigNumberish[];
    let testRoot: BigNumberish;
    let testParameters: BigNumberish;
    let nonPassingTestParameters: BigNumberish;

    let gradeGroup = new Group(1, MAX_TREE_DEPTH);
    let credentialsGroup = new Group(1, MAX_TREE_DEPTH);

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
        wasmFilePath: `../snark-artifacts/test${TEST_HEIGHT}.wasm`,
        zkeyFilePath: `../snark-artifacts/test${TEST_HEIGHT}.zkey`
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
        const openAnswers = generateOpenAnswers(["sneed's", "feed", "seed"], TEST_HEIGHT)

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
            true,
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
            true,
            testSnarkArtifacts
        )

        nonPassingProof = await generateTestProof(
            identity,
            { 
                multipleChoiceAnswers: Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 2), 
                openAnswers: generateOpenAnswers([], TEST_HEIGHT)
            },
            { ...testVariables, minimumGrade: 0 },
            new Group(1, MAX_TREE_DEPTH),
            new Group(1, MAX_TREE_DEPTH),
            false,
            testSnarkArtifacts
        )

        encodedTestCredentialData = encodeTestCredential(
            TEST_HEIGHT,
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

        encodedTestFullProof = encodeTestFullProof(testProof)
        encodedAltTestFullProof = encodeTestFullProof(altTestProof)

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
        const { registry, testManager, testVerifierAddress, gradeClaimVerifierAddress, pairingAddress } = await run("deploy:credentials-registry")

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
                    "0xfeed5eed"
                )).to.be.equal(false)
            })
        })
        
        context("when specified a supported interface", () => {
            it("returns true", async () => {
                expect(await testCredentialManager.supportsInterface(
                    "0x41be9068"
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
                            MAX_TREE_DEPTH,
                            encodedTestCredentialData
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CallerIsNotTheCredentialsRegistry"
                    )
                })
            })

            context("when the tree depth specified is not supported", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.createCredential(
                            1,
                            MAX_TREE_DEPTH + 1,
                            0,
                            0,
                            encodedTestCredentialData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "InvalidTreeDepth"  // Would be "MerkleTreeDepthIsNotSupported" if GradeClaimVerifier.sol supported 16-32
                    )
                })
            })

            context("when the test height specified is not supported", () => {
                it("reverts when giving a height below the lower bound", async () => {
                    const testData = encodeTestCredential(
                        Math.min(...SUPPORTED_TEST_HEIGHTS) - 1,
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

                    await expect(
                        credentialsRegistry.createCredential(
                            1,
                            MAX_TREE_DEPTH,
                            0,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestDepthIsNotSupported"
                    )
                })

                it("reverts when giving a height above the upper bound", async () => {
                    const testData = encodeTestCredential(
                        Math.max(...SUPPORTED_TEST_HEIGHTS) + 1,
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

                    await expect(
                        credentialsRegistry.createCredential(
                            1,
                            MAX_TREE_DEPTH,
                            0,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "TestDepthIsNotSupported"
                    )
                })
            })

            context("when the minimum grade specified is over the maximum", () => {
                it("reverts", async () => {
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
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
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
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
            
            context("when the number of questions specified is invalid", () => {
                it("reverts", async () => {
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
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
            
            context("when the time limit specified is in the past", () => {
                it("reverts for `timeLimit` > 0", async () => {
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
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
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                        1,
                        MAX_TREE_DEPTH,
                        0,
                        0,
                        testData,
                        credentialURI
                    )
                })
            })

            context("when the required credential specified is the new credential", () => {
                it("reverts", async () => {
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
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
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
                            0,
                            testData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "RequiredCredentialDoesNotExist"
                    )
                })
            })

            context("when the grade threshold is specified but not the required credential", () => {
                it("reverts", async () => {
                    const testData = encodeTestCredential(
                        TEST_HEIGHT,
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
                            1,
                            MAX_TREE_DEPTH,
                            0,
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

            context("after successfully creating a test credential", () => {
                beforeEach(async () => {
                    await credentialsRegistry.createCredential(1, MAX_TREE_DEPTH, 0, 15 * 60, encodedTestCredentialData, credentialURI)
                })

                it("sets the initial credential state to the corresponding zero struct", async () => {
                    let zeroValue = hash(1);

                    for (var i = 0; i < MAX_TREE_DEPTH; i++) {
                        zeroValue = poseidon([zeroValue, zeroValue]).toString();
                    }

                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(1)).to.be.equal(0)
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(2)).to.be.equal(0)
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(3)).to.be.equal(0)
                    expect(await credentialsRegistry.getMerkleTreeRoot(1)).to.be.equal(zeroValue)
                    expect(await credentialsRegistry.getMerkleTreeRoot(2)).to.be.equal(zeroValue)
                    expect(await credentialsRegistry.getMerkleTreeRoot(3)).to.be.equal(zeroValue)
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

        describe("getCredentialData", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialData(
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
                        1,
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
                        1,
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
                        1,
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
                        1,
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
                        1,
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
    })

    context("with created test credentials", () => {
        beforeEach(async () => {
            await credentialsRegistry.createCredential(1, MAX_TREE_DEPTH, 0, 15 * 60, encodedTestCredentialData, credentialURI)
        })

        describe("updateCredential", () => {
            context("when calling for an invalidated credential", () => {
                it("reverts", async () => {
                    await credentialsRegistry.invalidateCredential(1)

                    await expect(
                        credentialsRegistry.updateCredential(
                            1,
                            encodedTestFullProof
                        )
                    ).to.be.revertedWithCustomError(
                        testCredentialManager,
                        "CredentialWasInvalidated"
                    )
                })
            })

            describe("tests", () => {
                context("when providing an invalid proof", () => {
                    it("reverts", async () => {
                        const bogusProof = {
                            ...testProof,
                            gradeCommitment: 350
                        } as any

                        const encodedBogusProof = encodeTestFullProof(bogusProof)
                        
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
                                .to.be.equal((new Group(1, MAX_TREE_DEPTH)).root)
                        })

                        it("emits a `CredentialsMemberAdded` event", async () => {
                            await expect(tx)
                                .to.emit(testCredentialManager, "CredentialsMemberAdded")
                                .withArgs(1, 1, testProof.identityCommitment, testProof.newIdentityTreeRoot)
                        })

                        it("emits a `GradeMemberAdded` event", async () => {
                            await expect(tx)
                                .to.emit(testCredentialManager, "GradeMemberAdded")
                                .withArgs(1, 1, testProof.gradeCommitment, testProof.newGradeTreeRoot)
                        })
                    })
                })

                context("when setting `testPassed` to false", () => {
                    let tx;

                    beforeEach(async () => {
                        const encodedNonPassingProof = encodeTestFullProof(nonPassingProof)

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
                            const altGradeGroup = new Group(1, MAX_TREE_DEPTH)
                            altGradeGroup.addMember(nonPassingProof.gradeCommitment)

                            expect(await credentialsRegistry.getMerkleTreeRoot(1))
                                .to.be.equal(altGradeGroup.root)
                            expect(await credentialsRegistry.getMerkleTreeRoot(2))
                                .to.be.equal((new Group(1, MAX_TREE_DEPTH)).root)
                            expect(await credentialsRegistry.getMerkleTreeRoot(3))
                                .to.be.equal(credentialsGroup.root)
                        })

                        it("emits a `NoCredentialsMemberAdded` event", async () => {
                            await expect(tx)
                                .to.emit(testCredentialManager, "NoCredentialsMemberAdded")
                                .withArgs(1, 1, nonPassingProof.identityCommitment, nonPassingProof.newIdentityTreeRoot)
                        })

                        it("emits a `GradeMemberAdded` event", async () => {
                            await expect(tx)
                                .to.emit(testCredentialManager, "GradeMemberAdded")
                                .withArgs(1, 1, nonPassingProof.gradeCommitment, nonPassingProof.newGradeTreeRoot)
                        })
                    })
                })
            })

            describe("credential restricted tests", () => {
                beforeEach(async () => {
                    const encodedCredentialRestrictedTestData = encodeTestCredential(
                        TEST_HEIGHT,
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
                        2,
                        MAX_TREE_DEPTH,
                        0,
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
                            }
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

                    let restrictedCredentialsGroup = new Group(2, MAX_TREE_DEPTH);
                    let restrictedGradeGroup = new Group(2, MAX_TREE_DEPTH);
                    let requiredCredentialsGroup = new Group(1, MAX_TREE_DEPTH);

                    before(async () => {
                        requiredCredentialsGroup.addMember(identity.commitment)
                        
                        credentialRestrictedTestProof = await generateCredentialRestrictedTestProof(
                            identity,
                            testAnswers,
                            testVariables,
                            restrictedCredentialsGroup,
                            restrictedGradeGroup,
                            requiredCredentialsGroup,
                            true,
                            testSnarkArtifacts,
                            semaphoreSnarkArtifacts
                        )
                    })

                    it("clears", async () => {
                        const encodedCredentialRestrictedProof = encodeCredentialRestrictedTestFullProof(
                            credentialRestrictedTestProof
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
                    const encodedGradeRestrictedTestData = encodeTestCredential(
                        TEST_HEIGHT,
                        minimumGrade,
                        multipleChoiceWeight,
                        nQuestions,
                        0,
                        accounts[0],
                        1,
                        gradeThreshold,
                        multipleChoiceRoot,
                        openAnswersHashesRoot
                    )

                    await credentialsRegistry.createCredential(
                        2,
                        MAX_TREE_DEPTH,
                        0,
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
                            }
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

                    let restrictedCredentialsGroup = new Group(2, MAX_TREE_DEPTH);
                    let restrictedGradeGroup = new Group(2, MAX_TREE_DEPTH);
                    let gradeClaimGroup = new Group(1, MAX_TREE_DEPTH)

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
                            true,
                            testSnarkArtifacts,
                            gradeClaimSnarkArtifacts
                        )
                    })

                    it("clears", async () => {
                        const encodedGradeRestrictedProof = encodeGradeRestrictedTestFullProof(
                            gradeRestrictedTestProof
                        )

                        await credentialsRegistry.updateCredential(
                            2, 
                            encodedGradeRestrictedProof
                        )
                    })
                })
            })
        })

        describe("getCredentialData", () => {
            it("returns the correct credential data", async () => {
                const credentialData = abi.encode(
                    ["uint8", "uint8", "uint8", "uint8", "uint32", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
                    [TEST_HEIGHT, minimumGrade, multipleChoiceWeight, nQuestions, 0, accounts[0], 0, 0, multipleChoiceRoot, openAnswersHashesRoot, testRoot, testParameters, nonPassingTestParameters]
                )

                expect(await credentialsRegistry.getCredentialData(1))
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
                        "CredentialWasInvalidated"
                    )
                })
            })
        })
    })
})
