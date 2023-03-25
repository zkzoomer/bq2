import { 
    buildPoseidon,
    encodeTestInitializingParameters,
    encodeTestFullProof,
    generateOpenAnswers, 
    generateRateCredentialIssuerProof, 
    generateTestProof, 
    hash,
    rootFromLeafArray,  
    BigNumberish,
    Poseidon, 
    RateFullProof,
    TestFullProof,
    MAX_TREE_DEPTH, 
    TEST_HEIGHT,
    GradeClaimFullProof,
    generateGradeClaimProof
} from "@bq2/lib"
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
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
    GradeClaimVerifier,
    GradeClaimVerifier__factory,
    Pairing,
    Pairing__factory
} from "../typechain-types"

const TREE_DEPTH = 16

describe("CredentialsRegistry contract", () => {
    let poseidon: Poseidon; 

    let identity: Identity;
    let altIdentity: Identity;

    let credentialURI = 'https://twitter.com/0xdeenz';
    
    let openAnswersHashes: BigNumberish[];

    let gradeGroup = new Group(1, TREE_DEPTH);
    let credentialsGroup = new Group(1, TREE_DEPTH);

    let externalNullifier = 350;
    let signal = ethers.utils.formatBytes32String("I need bout tree fiddy");

    let credentialsRegistry: CredentialsRegistry;
    let testCredentialManager: TestCredentialManager;
    let gradeClaimVerifier: GradeClaimVerifier;
    let pairing: Pairing;
    let invalidCredentialManagerAddress: string;

    let encodedTestCredentialData: string;
    let encodedTestFullProof: string;
    let encodedAltTestFullProof: string;

    let signers: Signer[];
    let accounts: string[];

    let testProof: TestFullProof;
    let altTestProof: TestFullProof;
    let ratingProof: RateFullProof;
    let altRatingProof: RateFullProof;

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

        const minimumGrade = 50;
        const multipleChoiceWeight = 50;
        const nQuestions = 3;
        const gradeThreshold = 80;

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

        const testVariables = {
            minimumGrade,
            multipleChoiceWeight, 
            nQuestions,
            multipleChoiceRoot,
            openAnswersHashesRoot,
            openAnswersHashes
        }

        testProof = await generateTestProof(
            identity,
            { multipleChoiceAnswers, openAnswers },
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
            { multipleChoiceAnswers, openAnswers },
            testVariables,
            credentialsGroup,
            gradeGroup,
            true,
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

        encodedTestFullProof = encodeTestFullProof(testProof)
        encodedAltTestFullProof = encodeTestFullProof(altTestProof)

        const ratingGroup = new Group(1, MAX_TREE_DEPTH)
        ratingGroup.addMember(identity.commitment)

        ratingProof = await generateRateCredentialIssuerProof(identity, ratingGroup, 100, "sneed", semaphoreSnarkArtifacts)
        ratingGroup.addMember(altIdentity.commitment)
        altRatingProof = await generateRateCredentialIssuerProof(altIdentity, ratingGroup, 15, "chuck", semaphoreSnarkArtifacts)

        credentialOwnershipProof = await generateProof(identity, credentialsGroup, externalNullifier, signal, semaphoreSnarkArtifacts)
        gradeClaimProof = await generateGradeClaimProof(identity, gradeGroup, gradeThreshold, externalNullifier, signal, testVariables, gradeClaimSnarkArtifacts)

        const InvalidCredentialManagerFactory = await ethers.getContractFactory("InvalidCredentialManager")
        const invalidCredentialManager = await InvalidCredentialManagerFactory.deploy()
        await invalidCredentialManager.deployed()

        invalidCredentialManagerAddress = invalidCredentialManager.address
    })

    beforeEach(async () => {
        const { registry, testManager, pairingAddress, gradeClaimVerifierAddress } = await run("deploy:credentials-registry", {
            logs: false, 
            connectTestManager: true
        })

        credentialsRegistry = registry
        testCredentialManager = testManager
        pairing = Pairing__factory.connect(pairingAddress, signers[0])
        gradeClaimVerifier = GradeClaimVerifier__factory.connect(gradeClaimVerifierAddress, signers[0])
    })

    describe("defineCredentialType", () => {
        context("when specifying an invalid credential manager", () => {
            it("reverts", async () => {
                await expect(
                    credentialsRegistry.defineCredentialType(
                        1,
                        invalidCredentialManagerAddress
                    )
                ).to.be.revertedWithCustomError(
                    credentialsRegistry,
                    "InvalidCredentialManagerAddress"
                )
            })
        })

        context("after specifying a valid credential type", () => {
            context("when trying to override the credential type", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.defineCredentialType(
                            0,
                            testCredentialManager.address
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialTypeAlreadyDefined"
                    )
                })
            })
        })
    })

    context("without created credentials", () => {
        describe("createCredential", () => {
            context("when the tree depth specified is invalid", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.createCredential(
                            15,
                            0,
                            0,
                            encodedTestCredentialData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "InvalidTreeDepth"
                    )

                    await expect(
                        credentialsRegistry.createCredential(
                            MAX_TREE_DEPTH + 1,
                            0,
                            0,
                            encodedTestCredentialData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "InvalidTreeDepth"
                    )
                })
            })

            context("when the credential type specified is not defined", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.createCredential(
                            TREE_DEPTH,
                            1,
                            0,
                            encodedTestCredentialData,
                            credentialURI
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialTypeDoesNotExist"
                    )
                })
            })

            context("after creating a credential", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsRegistry.createCredential(
                        TREE_DEPTH,
                        0,
                        0,
                        encodedTestCredentialData,
                        credentialURI
                    )
                })

                it("emits a `CredentialCreated` event", async () => {
                    let zeroValue = hash(1);

                    for (var i = 0; i < TREE_DEPTH; i++) {
                        zeroValue = poseidon([zeroValue, zeroValue]).toString();
                    }

                    await expect(tx)
                        .to.emit(credentialsRegistry, "CredentialCreated")
                        .withArgs('1', '0', TREE_DEPTH, zeroValue.toString())
                })

                it("increases the `nCredentials` variable", async () => {
                    expect(
                        await credentialsRegistry.nCredentials()
                    ).to.be.equal('1')
                })
            })
        })

        describe("updateCredential", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.updateCredential(
                            1,
                            abi.encode(["string"], ["some data"])
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
            
        })

        describe("invalidateCredential", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.invalidateCredential(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("rateCredential", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.rateCredential(
                            1,
                            ratingProof.semaphoreFullProof.merkleTreeRoot,
                            ratingProof.semaphoreFullProof.nullifierHash,
                            ratingProof.semaphoreFullProof.proof,
                            ratingProof.rating,
                            ratingProof.comment
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("verifyCredentialOwnershipProof", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.verifyCredentialOwnershipProof(
                            1,
                            credentialOwnershipProof.merkleTreeRoot,
                            credentialOwnershipProof.nullifierHash,
                            credentialOwnershipProof.signal,
                            credentialOwnershipProof.externalNullifier,
                            credentialOwnershipProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("verifyGradeClaimProof", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.verifyGradeClaimProof(
                            1,
                            gradeClaimProof.gradeTreeRoot,
                            gradeClaimProof.nullifierHash,
                            gradeClaimProof.gradeThreshold,
                            gradeClaimProof.signal,
                            gradeClaimProof.externalNullifier,
                            gradeClaimProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialData", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialData(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialURI", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialURI(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialAdmin", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialAdmin(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialType", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialType(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialManager", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialManager(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialAverageRating", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getCredentialAverageRating(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getMerkleRootCreationDate", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getMerkleRootCreationDate(
                            1,
                            0
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("wasNullifierHashUsed", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.wasNullifierHashUsed(
                            1,
                            0
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("credentialExists", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.credentialExists(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("credentialIsValid", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.credentialIsValid(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getMerkleTreeRoot", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getMerkleTreeRoot(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getMerkleTreeDepth", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getMerkleTreeDepth(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getNumberOfMerkleTreeLeaves", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getNumberOfMerkleTreeLeaves(
                            1
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })
        })
    })

    context("with created credentials", () => {
        beforeEach(async () => {
            await credentialsRegistry.createCredential(TREE_DEPTH, 0, 15 * 60, encodedTestCredentialData, credentialURI)
            await credentialsRegistry.updateCredential(1, encodedTestFullProof)
        })

        describe("rateCredential", () => {
            context("when providing an invalid rating", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.rateCredential(
                            1,
                            ratingProof.semaphoreFullProof.merkleTreeRoot,
                            ratingProof.semaphoreFullProof.nullifierHash,
                            ratingProof.semaphoreFullProof.proof,
                            101,
                            ratingProof.comment
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "InvalidRating"
                    )
                })
            })

            context("when providing an invalid proof", () => {
                it("reverts", async () => {
                    const bogusProof = [...ratingProof.semaphoreFullProof.proof]
                    bogusProof[0] = 350 as any
                    
                    await expect(
                        credentialsRegistry.rateCredential(
                            1,
                            ratingProof.semaphoreFullProof.merkleTreeRoot,
                            ratingProof.semaphoreFullProof.nullifierHash,
                            bogusProof,
                            ratingProof.rating,
                            ratingProof.comment
                        )
                    ).to.be.revertedWithCustomError(
                        pairing,
                        "InvalidProof"
                    )
                })
            })

            context("when providing an invalid Merkle root", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.rateCredential(
                            1,
                            0,
                            ratingProof.semaphoreFullProof.nullifierHash,
                            ratingProof.semaphoreFullProof.proof,
                            ratingProof.rating,
                            ratingProof.comment
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsNotPartOfTheGroup"
                    )
                })
            })

            context("when providing an expired Merkle root", () => {
                it("reverts", async () => {
                    mine()
                    const currentTimestamp = await time.latest()

                    await credentialsRegistry.updateCredential(1, encodedAltTestFullProof)

                    time.setNextBlockTimestamp(currentTimestamp + 16*60)
                    mine()

                    await expect(
                        credentialsRegistry.rateCredential(
                            1,
                            ratingProof.semaphoreFullProof.merkleTreeRoot,
                            ratingProof.semaphoreFullProof.nullifierHash,
                            ratingProof.semaphoreFullProof.proof,
                            ratingProof.rating,
                            ratingProof.comment
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsExpired"
                    )
                })
            })

            context("when providing a used nullifier", () => {
                it("reverts", async () => {
                    await credentialsRegistry.rateCredential(
                        1,
                        ratingProof.semaphoreFullProof.merkleTreeRoot,
                        ratingProof.semaphoreFullProof.nullifierHash,
                        ratingProof.semaphoreFullProof.proof,
                        ratingProof.rating,
                        ratingProof.comment
                    )
                    
                    await expect(
                        credentialsRegistry.rateCredential(
                            1,
                            ratingProof.semaphoreFullProof.merkleTreeRoot,
                            ratingProof.semaphoreFullProof.nullifierHash,
                            ratingProof.semaphoreFullProof.proof,
                            ratingProof.rating,
                            ratingProof.comment
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "UsingSameNullifierTwice"
                    )
                })
            })

            context("after a successful call", () => {
                let tx;

                beforeEach(async () => {
                    tx = await credentialsRegistry.rateCredential(
                        1,
                        ratingProof.semaphoreFullProof.merkleTreeRoot,
                        ratingProof.semaphoreFullProof.nullifierHash,
                        ratingProof.semaphoreFullProof.proof,
                        ratingProof.rating,
                        ratingProof.comment
                    )
                })

                it("increases the total rating by the rate given", async () => {
                    expect((await credentialsRegistry.credentialRatings(1))[0])
                        .to.be.equal(ratingProof.rating)
                })

                it("increases the total number of ratings by one", async () => {
                    expect((await credentialsRegistry.credentialRatings(1))[1])
                        .to.be.equal(1)
                })

                it("emits a `NewRating` event", async () => {
                    await expect(tx)
                        .to.emit(credentialsRegistry, "NewCredentialRating")
                        .withArgs(1, accounts[0], ratingProof.rating, ratingProof.comment)
                })
            })
        })

        describe("verifyCredentialOwnershipProof", () => {
            context("when providing an invalid proof", () => {
                it("reverts", async () => {
                    const bogusProof = [...credentialOwnershipProof.proof]
                    bogusProof[0] = 350 as any

                    await expect(
                        credentialsRegistry.verifyCredentialOwnershipProof(
                            1,
                            credentialOwnershipProof.merkleTreeRoot,
                            credentialOwnershipProof.nullifierHash,
                            credentialOwnershipProof.signal,
                            credentialOwnershipProof.externalNullifier,
                            bogusProof
                        )
                    ).to.be.revertedWithCustomError(
                        pairing,
                        "InvalidProof"
                    )
                })
            })

            context("when providing an invalid Merkle root", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.verifyCredentialOwnershipProof(
                            1,
                            0,
                            credentialOwnershipProof.nullifierHash,
                            credentialOwnershipProof.signal,
                            credentialOwnershipProof.externalNullifier,
                            credentialOwnershipProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsNotPartOfTheGroup"
                    )
                })
            })

            context("when providing an expired Merkle root", () => {
                it("reverts", async () => {
                    mine()
                    const currentTimestamp = await time.latest()

                    await credentialsRegistry.updateCredential(1, encodedAltTestFullProof)

                    time.setNextBlockTimestamp(currentTimestamp + 16*60)
                    mine()

                    await expect(
                        credentialsRegistry.verifyCredentialOwnershipProof(
                            1,
                            credentialOwnershipProof.merkleTreeRoot,
                            credentialOwnershipProof.nullifierHash,
                            credentialOwnershipProof.signal,
                            credentialOwnershipProof.externalNullifier,
                            credentialOwnershipProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsExpired"
                    )
                })
            })

            context("when providing a used nullifier", () => {
                it("reverts", async () => {
                    await credentialsRegistry.verifyCredentialOwnershipProof(
                        1,
                        credentialOwnershipProof.merkleTreeRoot,
                        credentialOwnershipProof.nullifierHash,
                        credentialOwnershipProof.signal,
                        credentialOwnershipProof.externalNullifier,
                        credentialOwnershipProof.proof
                    )

                    await expect(
                        credentialsRegistry.verifyCredentialOwnershipProof(
                            1,
                            credentialOwnershipProof.merkleTreeRoot,
                            credentialOwnershipProof.nullifierHash,
                            credentialOwnershipProof.signal,
                            credentialOwnershipProof.externalNullifier,
                            credentialOwnershipProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "UsingSameNullifierTwice"
                    )
                })
            })

            context("after a successfull call", () => {
                beforeEach(async () => {
                    await credentialsRegistry.verifyCredentialOwnershipProof(
                        1,
                        credentialOwnershipProof.merkleTreeRoot,
                        credentialOwnershipProof.nullifierHash,
                        credentialOwnershipProof.signal,
                        credentialOwnershipProof.externalNullifier,
                        credentialOwnershipProof.proof
                    )
                })

                it("voids the nullifier given", async () => {
                    expect(await credentialsRegistry.wasNullifierHashUsed(1, credentialOwnershipProof.nullifierHash))
                        .to.be.equal(true)
                })
            })
        })

        describe("verifyGradeClaimProof", () => {
            context("when providing an invalid proof", () => {
                it("reverts", async () => {
                    const bogusProof = [...gradeClaimProof.proof]
                    bogusProof[0] = 350 as any

                    await expect(
                        credentialsRegistry.verifyGradeClaimProof(
                            1,
                            gradeClaimProof.gradeTreeRoot,
                            gradeClaimProof.nullifierHash,
                            gradeClaimProof.gradeThreshold,
                            gradeClaimProof.signal,
                            gradeClaimProof.externalNullifier,
                            bogusProof
                        )
                    ).to.revertedWithoutReason

                    //to.be.revertedWithCustomError(
                    //    gradeClaimVerifier,
                    //    "InvalidProof"
                    //)
                })
            })

            context("when providing an invalid Merkle root", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.verifyGradeClaimProof(
                            1,
                            0,
                            gradeClaimProof.nullifierHash,
                            gradeClaimProof.gradeThreshold,
                            gradeClaimProof.signal,
                            gradeClaimProof.externalNullifier,
                            gradeClaimProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsNotPartOfTheGroup"
                    )
                })
            })

            context("when providing an expired Merkle root", () => {
                it("reverts", async () => {
                    mine()
                    const currentTimestamp = await time.latest()

                    await credentialsRegistry.updateCredential(1, encodedAltTestFullProof)

                    time.setNextBlockTimestamp(currentTimestamp + 16*60)
                    mine()

                    await expect(
                        credentialsRegistry.verifyGradeClaimProof(
                            1,
                            gradeClaimProof.gradeTreeRoot,
                            gradeClaimProof.nullifierHash,
                            gradeClaimProof.gradeThreshold,
                            gradeClaimProof.signal,
                            gradeClaimProof.externalNullifier,
                            gradeClaimProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsExpired"
                    )
                })
            })

            context("when providing a used nullifier", () => {
                it("reverts", async () => {
                    await credentialsRegistry.verifyGradeClaimProof(
                        1,
                        gradeClaimProof.gradeTreeRoot,
                        gradeClaimProof.nullifierHash,
                        gradeClaimProof.gradeThreshold,
                        gradeClaimProof.signal,
                        gradeClaimProof.externalNullifier,
                        gradeClaimProof.proof
                    )

                    await expect(
                        credentialsRegistry.verifyGradeClaimProof(
                            1,
                            gradeClaimProof.gradeTreeRoot,
                            gradeClaimProof.nullifierHash,
                            gradeClaimProof.gradeThreshold,
                            gradeClaimProof.signal,
                            gradeClaimProof.externalNullifier,
                            gradeClaimProof.proof
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "UsingSameNullifierTwice"
                    )
                })
            })

            context("after a successfull call", () => {
                beforeEach(async () => {
                    await credentialsRegistry.verifyGradeClaimProof(
                        1,
                        gradeClaimProof.gradeTreeRoot,
                        gradeClaimProof.nullifierHash,
                        gradeClaimProof.gradeThreshold,
                        gradeClaimProof.signal,
                        gradeClaimProof.externalNullifier,
                        gradeClaimProof.proof
                    )
                })

                it("voids the nullifier given", async () => {
                    expect(await credentialsRegistry.wasNullifierHashUsed(1, gradeClaimProof.nullifierHash))
                        .to.be.equal(true)
                })
            })
        })

        describe("getCredentialURI", () => {
            context("when calling for a credential that does exist", () => {
                it("returns the correct credential URI", async () => {
                    expect(await credentialsRegistry.getCredentialURI(1))
                        .to.be.equal(credentialURI)
                })
            })
        })

        describe("getCredentialType", () => {
            it("returns the credential type", async () => {
                expect(
                    await credentialsRegistry.getCredentialType(1)
                ).to.be.equal('0')
            })
        })

        describe("getCredentialManager", () => {
            it("returns the contract address managing the credential", async () => {
                expect(
                    await credentialsRegistry.getCredentialManager(1)
                ).to.be.equal(testCredentialManager.address)
            })
        })

        describe("getCredentialAverageRating", () => {
            context("before any ratings are made", () => {
                it("returns 0", async () => {
                    expect(
                        await credentialsRegistry.getCredentialAverageRating(1)
                    ).to.be.equal(0)
                })
            })

            context("after making ratings", () => {
                beforeEach(async () => {
                    await credentialsRegistry.rateCredential(
                        1,
                        ratingProof.semaphoreFullProof.merkleTreeRoot,
                        ratingProof.semaphoreFullProof.nullifierHash,
                        ratingProof.semaphoreFullProof.proof,
                        ratingProof.rating,
                        ratingProof.comment
                    )

                    await credentialsRegistry.updateCredential(1, encodedAltTestFullProof)

                    await credentialsRegistry.rateCredential(
                        1,
                        altRatingProof.semaphoreFullProof.merkleTreeRoot,
                        altRatingProof.semaphoreFullProof.nullifierHash,
                        altRatingProof.semaphoreFullProof.proof,
                        altRatingProof.rating,
                        altRatingProof.comment
                    )
                })

                it("returns the average rating given", async () => {
                    expect(await credentialsRegistry.getCredentialAverageRating(1))
                        .to.be.equal(Math.floor((ratingProof.rating + altRatingProof.rating)/2))
                })
            })
        })

        describe("getMerkleRootCreationDate", () => {
            context("when specifying a root that is not part of the group", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.getMerkleRootCreationDate(
                            1,
                            0
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "MerkleTreeRootIsNotPartOfTheGroup"
                    )
                })
            })

            context("when specifying a valid root", () => {
                it("returns the correct creation date", async () => {
                    expect(await credentialsRegistry.getMerkleRootCreationDate(1, credentialsGroup.root))
                        .to.be.equal((await ethers.provider.getBlock("latest")).timestamp)
                })
            })
        })

        describe("wasNullifierHashUsed", () => {
            context("when specifying a nullifier that was not used", () => {
                it("returns false", async () => {
                    expect(await credentialsRegistry.wasNullifierHashUsed(1, 0))
                        .to.be.equal(false)
                })
            })

            // nullifier that was used was tested on `verifyCredentialOwnershipProof` and  `verifyGradeClaimProof` tests
        })

        describe("getMerkleTreeRoot", () => {
            it("returns the empty root for the different groups that make up a new credential", async () => {
                await credentialsRegistry.createCredential(TREE_DEPTH, 0, 15 * 60, encodedTestCredentialData, credentialURI)
                const expectedRoot = (new Group(2, MAX_TREE_DEPTH)).root
                
                expect(await credentialsRegistry.getMerkleTreeRoot(4))
                    .to.be.equal(expectedRoot)   
                expect(await credentialsRegistry.getMerkleTreeRoot(5))
                    .to.be.equal(expectedRoot)   
                expect(await credentialsRegistry.getMerkleTreeRoot(6))
                    .to.be.equal(expectedRoot)   
            })

            it("returns the expected roots for an updated credential", async () => {
                expect(await credentialsRegistry.getMerkleTreeRoot(1))
                    .to.be.equal(gradeGroup.root)   
                expect(await credentialsRegistry.getMerkleTreeRoot(2))
                    .to.be.equal(credentialsGroup.root)   
                expect(await credentialsRegistry.getMerkleTreeRoot(3))
                    .to.be.equal((new Group(1, MAX_TREE_DEPTH)).root)   
            })
        })

        describe("getMerkleTreeDepth", () => {
            it(`returns ${TREE_DEPTH} for the different groups that make up the credential`, async () => {
                expect(await credentialsRegistry.getMerkleTreeDepth(1))
                    .to.be.equal(TREE_DEPTH)   
                expect(await credentialsRegistry.getMerkleTreeDepth(2))
                    .to.be.equal(TREE_DEPTH)   
                expect(await credentialsRegistry.getMerkleTreeDepth(3))
                    .to.be.equal(TREE_DEPTH)     
            })
        })

        describe("getNumberOfMerkleTreeLeaves", () => {
            it("returns `0` for the different groups that make up a new credential", async () => {
                await credentialsRegistry.createCredential(TREE_DEPTH, 0, 15 * 60, encodedTestCredentialData, credentialURI)
                
                expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(4))
                    .to.be.equal(0)   
                expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(5))
                    .to.be.equal(0)   
                expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(6))
                    .to.be.equal(0)    
            })

            it("returns the expected values for an updated credential", async () => {                
                expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(1))
                    .to.be.equal(1)   
                expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(2))
                    .to.be.equal(1)   
                expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(3))
                    .to.be.equal(0)    
            })
        })
    })
})
