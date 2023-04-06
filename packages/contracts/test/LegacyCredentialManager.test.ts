import { MAX_TREE_DEPTH } from "@bq2/lib";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, FullProof } from '@semaphore-protocol/proof';
import { expect } from "chai";
import { utils, Signer } from "ethers"
import { ethers, run } from "hardhat";
import { describe } from "mocha";
import { CredentialsRegistry, LegacyCredentialManager } from "../typechain-types"

describe("LegacyCredentialManager contract", () => {
    let credentialURI = 'https://twitter.com/0xdeenz';

    let signers: Signer[];
    let accounts: string[];

    let credentialsRegistry: CredentialsRegistry;
    let legacyCredentialManager: LegacyCredentialManager;
    let mockCredentialManagerAddress: string;
    
    let intialCredentialState = [1, 2, 3, 4, 5, 6, 50];
    let encodedCredentialData: string;

    let newCredentialState = [7, 8, 9, 10, 11, 12];
    let encodedNewCredentialState: string;

    let abi = utils.defaultAbiCoder

    before(async () => {
        signers = await run("accounts", { logs: false })
        accounts = await Promise.all(signers.map((signer: Signer) => signer.getAddress()))

        encodedCredentialData = abi.encode(
            ["uint80", "uint80", "uint80", "uint256", "uint256", "uint256", "uint256"],
            intialCredentialState
        )

        encodedNewCredentialState = abi.encode(
            ["uint80", "uint80", "uint80", "uint256", "uint256", "uint256"],
            newCredentialState
        )
        
        const MockCredentialManagerFactory = await ethers.getContractFactory("MockCredentialManager")
        const mockCredentialManager = await MockCredentialManagerFactory.deploy()
        await mockCredentialManager.deployed()

        mockCredentialManagerAddress = mockCredentialManager.address
    })

    beforeEach(async () => {
        const { registry, legacyManager } = await run("deploy:credentials-registry")

        credentialsRegistry = registry
        legacyCredentialManager = legacyManager

        await credentialsRegistry.defineCredentialType(2, mockCredentialManagerAddress)
    })

    describe("supportsInterface", () => {
        context("when specified a non supported interface", () => {
            it("returns false", async () => {
                expect(await legacyCredentialManager.supportsInterface(
                    "0xfeed5eed"
                )).to.be.equal(false)
            })
        })
        
        context("when specified a supported interface", () => {
            it("returns true", async () => {
                expect(await legacyCredentialManager.supportsInterface(
                    "0x41be9068"
                )).to.be.equal(true)
            })
        })
    })

    context("without created legacy credentials", () => {
        describe("createCredential", () => {
            context("when being called directly and not through the registry", async () => {
                it("reverts", async () => {
                    await expect(
                        legacyCredentialManager.createCredential(
                            1,
                            MAX_TREE_DEPTH,
                            encodedCredentialData
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "CallerIsNotTheCredentialsRegistry"
                    )
                })
            })

            context("after creating a legacy credential", () => {
                beforeEach(async () => {
                    await credentialsRegistry.createCredential(1, MAX_TREE_DEPTH, 1, 0, encodedCredentialData, credentialURI)
                })

                it("sets the legacy credential admin to the original transaction sender", async () => {
                    expect(await credentialsRegistry.getCredentialAdmin(1)).to.be.equal(accounts[0])
                })

                it("sets the credential state to the one sent", async () => {
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(1)).to.be.equal(intialCredentialState[0])
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(2)).to.be.equal(intialCredentialState[1])
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(3)).to.be.equal(intialCredentialState[2])
                    expect(await credentialsRegistry.getMerkleTreeRoot(1)).to.be.equal(intialCredentialState[3])
                    expect(await credentialsRegistry.getMerkleTreeRoot(2)).to.be.equal(intialCredentialState[4])
                    expect(await credentialsRegistry.getMerkleTreeRoot(3)).to.be.equal(intialCredentialState[5])
                })

                it("sets the minimum grade to the one sent", async () => {
                    expect(await legacyCredentialManager.minimumGrades(1)).to.be.equal(intialCredentialState[6])
                })
            })
        })

        describe("updateCredential", () => {
            context("when being called directly and not through the registry", () => {
                it("reverts", async () => {
                    await expect(
                        legacyCredentialManager.updateCredential(
                            1, 
                            { credentialsTreeIndex: 0, noCredentialsTreeIndex: 0, gradeTreeIndex: 0, gradeTreeRoot: 0, credentialsTreeRoot: 0, noCredentialsTreeRoot: 0},
                            '0x00'
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "CallerIsNotTheCredentialsRegistry"
                    )
                })
            })
        })

        describe("getCredentialData", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        legacyCredentialManager.getCredentialData(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a legacy credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        1,
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedCredentialData,
                        credentialURI
                    )

                    await expect(
                        legacyCredentialManager.getCredentialData(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "LegacyCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("getCredentialAdmin", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    it("reverts", async () => {
                        await expect(
                            legacyCredentialManager.getCredentialAdmin(
                                1,
                            )
                        ).to.be.revertedWithCustomError(
                            credentialsRegistry,
                            "CredentialDoesNotExist"
                        )
                    })
                })
            })

            context("when calling for a legacy credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        1,
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedCredentialData,
                        credentialURI
                    )

                    await expect(
                        legacyCredentialManager.getCredentialAdmin(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "LegacyCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("credentialIsValid", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        legacyCredentialManager.credentialIsValid(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a legacy credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        1,
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedCredentialData,
                        credentialURI
                    )

                    await expect(
                        legacyCredentialManager.credentialIsValid(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "LegacyCredentialDoesNotExist"
                    )
                })
            })
        })

        describe("credentialExists", () => {
            context("when calling for a credential that does not exist", () => {
                it("reverts", async () => {
                    await expect(
                        legacyCredentialManager.credentialExists(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        credentialsRegistry,
                        "CredentialDoesNotExist"
                    )
                })
            })

            context("when calling for a legacy credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        1,
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedCredentialData,
                        credentialURI
                    )
                    
                    await expect(
                        legacyCredentialManager.credentialExists(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "LegacyCredentialDoesNotExist"
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

            context("when calling for a legacy credential that does not exist", () => {
                it("reverts", async () => {
                    await credentialsRegistry.createCredential(
                        1,
                        MAX_TREE_DEPTH,
                        2,
                        0,
                        encodedCredentialData,
                        credentialURI
                    )
                    
                    await expect(
                        legacyCredentialManager.invalidateCredential(
                            1,
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "LegacyCredentialDoesNotExist"
                    )
                })
            })
        })
    })

    context("with created legacy credentiasl", () => {
        beforeEach(async () => {
            await credentialsRegistry.createCredential(1, MAX_TREE_DEPTH, 1, 0, encodedCredentialData, credentialURI)
        })

        describe("updateCredential", () => {
            context("when calling for an invalidated credential", () => {
                it("reverts", async () => {
                    await credentialsRegistry.invalidateCredential(1)

                    await expect(
                        credentialsRegistry.updateCredential(
                            1,
                            encodedNewCredentialState
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "CredentialWasInvalidated"
                    )
                })
            })

            context("when being called by someone other than the legacy credential admin", () => {
                it("reverts", async () => {
                    await expect(
                        credentialsRegistry.connect(signers[1]).updateCredential(
                            1,
                            encodedNewCredentialState
                        )
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "CallerIsNotTheCredentialAdmin"
                    )
                })
            })

            context("after a successful call", () => {
                it("updates the credentials registry to the new state of the legacy credential", async () => {
                    await credentialsRegistry.updateCredential(
                        1,
                        encodedNewCredentialState
                    )

                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(1)).to.be.equal(newCredentialState[0])
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(2)).to.be.equal(newCredentialState[1])
                    expect(await credentialsRegistry.getNumberOfMerkleTreeLeaves(3)).to.be.equal(newCredentialState[2])
                    expect(await credentialsRegistry.getMerkleTreeRoot(1)).to.be.equal(newCredentialState[3])
                    expect(await credentialsRegistry.getMerkleTreeRoot(2)).to.be.equal(newCredentialState[4])
                    expect(await credentialsRegistry.getMerkleTreeRoot(3)).to.be.equal(newCredentialState[5])
                })
            })
        })

        describe("getCredentialData", () => {
            it("returns the correct credential data", async () => {
                expect(await credentialsRegistry.getCredentialData(1))
                    .to.be.equal(encodedCredentialData)
            })
        })

        describe("getCredentialAdmin", () => {
            it("returns the correct credential admin", async () => {
                expect(await legacyCredentialManager.getCredentialAdmin(1))
                    .to.be.equal(accounts[0])
            })
        })

        describe("credentialIsValid", () => {
            it("returns true for new legacy credentials", async () => {
                expect(await legacyCredentialManager.credentialIsValid(1))
                    .to.be.equal(true)
            })
        })

        describe("credentialExists", () => {
            it("returns true for new legacy credentials", async () => {
                expect(await legacyCredentialManager.credentialExists(1))
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
                        legacyCredentialManager,
                        "CallerIsNotTheCredentialAdmin"
                    )
                })
            })

            context("when calling for a currently valid credential", () => {
                it("invalidates them", async () => {
                    await credentialsRegistry.invalidateCredential(1)

                    expect(await legacyCredentialManager.credentialIsValid(1))
                        .to.be.equal(false)
                })
            })

            context("when calling for an invalidated credential", () => {
                it("reverts", async () => {
                    await credentialsRegistry.invalidateCredential(1)

                    await expect(
                        credentialsRegistry.invalidateCredential(1)
                    ).to.be.revertedWithCustomError(
                        legacyCredentialManager,
                        "CredentialWasInvalidated"
                    )
                })
            })
        })
    })
})
