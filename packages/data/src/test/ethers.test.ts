import TestCredentialGroupsEthers from "../ethers"
import getEvents from "../getEvents"

jest.mock("../getEvents", () => ({
    __esModule: true,
    default: jest.fn()
}))

jest.mock("@ethersproject/contracts", () => ({
    __esModule: true,
    Contract: jest.fn(
        () =>
            ({
                getMerkleTreeRoot: () => "222",
                getNumberOfMerkleTreeLeaves: () => ({
                    toNumber: () => 2
                })
            })
    )
}))

const getEventsMocked = getEvents as jest.MockedFunction<typeof getEvents>

describe("TestCredentialGroupsEthers", () => {
    let testCredential: TestCredentialGroupsEthers

    describe("# SemaphoreEthers", () => {
        it("Should instantiate a SemaphoreEthers object with different networks", () => {
            testCredential = new TestCredentialGroupsEthers()
            const testCredential1 = new TestCredentialGroupsEthers("homestead", {
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                credentialsRegistryStartBlock: 0,
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerStartBlock: 0,
                
            })

            expect(testCredential.network).toBe("maticmum")
            expect(testCredential.credentialsRegistryContract).toBeInstanceOf(Object)
            expect(testCredential.testCredentialManagerContract).toBeInstanceOf(Object)
            expect(testCredential1.network).toBe("homestead")
            expect(testCredential1.options.credentialsRegistryStartBlock).toBe(0)
            expect(testCredential1.options.credentialsRegistryAddress).toContain("0x000000")
            expect(testCredential1.options.testCredentialManagerStartBlock).toBe(0)
            expect(testCredential1.options.testCredentialManagerAddress).toContain("0x000000")
        })

        it("Should instantiate a TestCredentialGroupsEthers object with different providers", () => {
            const testCredential1 = new TestCredentialGroupsEthers("homestead", {
                provider: "infura",
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
                apiKey: "1234567890"
            })
            const testCredential2 = new TestCredentialGroupsEthers("homestead", {
                provider: "etherscan",
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
            })
            const testCredential3 = new TestCredentialGroupsEthers("homestead", {
                provider: "alchemy",
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
            })
            const testCredential4 = new TestCredentialGroupsEthers("homestead", {
                provider: "cloudflare",
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
            })
            const testCredential5 = new TestCredentialGroupsEthers("homestead", {
                provider: "pocket",
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
            })
            const testCredential6 = new TestCredentialGroupsEthers("homestead", {
                provider: "ankr",
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
            })

            expect(testCredential1.options.provider).toBe("infura")
            expect(testCredential1.options.apiKey).toBe("1234567890")
            expect(testCredential2.options.provider).toBe("etherscan")
            expect(testCredential3.options.provider).toBe("alchemy")
            expect(testCredential4.options.provider).toBe("cloudflare")
            expect(testCredential5.options.provider).toBe("pocket")
            expect(testCredential6.options.provider).toBe("ankr")
        })

        it("Should instantiate a TestCredentialGroupsEthers object with a custom URL", () => {
            const testCredential = new TestCredentialGroupsEthers("http://localhost:8545", {
                credentialsRegistryAddress: "0x0000000000000000000000000000000000000000",
                testCredentialManagerAddress: "0x0000000000000000000000000000000000000000",
            })

            expect(testCredential.network).toBe("http://localhost:8545")
        })

        it("Should throw an error if the network is not supported by TestCredentialGroupsEthers yet and there's no address", () => {
            const fun = () => new TestCredentialGroupsEthers("homestead")

            expect(fun).toThrow("You should provide contract addresses for this network")
        })

        it("Should throw an error if the provider is not supported", () => {
            const fun = () =>
                new TestCredentialGroupsEthers("maticmum", {
                    provider: "sneed" as any
                })

            expect(fun).toThrow("Provider 'sneed' is not supported")
        })
    })

    describe("# getCredentialIds", () => {
        it("Should return all the existing credentials", async () => {
            getEventsMocked.mockReturnValueOnce(Promise.resolve([["32", "1"], ["42", "0"]]))

            const groupIds = await testCredential.getCredentialIds()

            expect(groupIds).toStrictEqual(["42"])
        })
    })

    describe("# getGroup", () => {
        it("Should return a specific group", async () => {
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        merkleTreeDepth: "20",
                        zeroValue: "111"
                    }
                ])
            )

            const group = await testCredential.getGroup("42", "grade")

            expect(group.merkleTree.depth).toBe("20")
            expect(group.merkleTree.root).toBe("222")
            expect(group.merkleTree.zeroValue).toContain("111")
        })

        it("Should throw an error if the group does not exist", async () => {
            getEventsMocked.mockReturnValueOnce(Promise.resolve([]))

            const fun1 = () => testCredential.getGroup("420", "grade")

            await expect(fun1).rejects.toThrow("Credential '420' not found")

            const fun2 = () => testCredential.getGroup("420", "sneed" as any) 

            await expect(fun2).rejects.toThrow("Parameter 'sneed' is not either 'grade', 'credentials', or 'no-credentials'")
        })
    })

    describe("# getGroupMembers", () => {
        it("Should return a list of grade group members", async () => {
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        merkleTreeDepth: "20",
                        zeroValue: "0"
                    }
                ])
            )
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        index: "0",
                        gradeCommitment: "110",
                        merkleTreeRoot: "220",
                        blockNumber: 0
                    },
                    {
                        index: "1",
                        gradeCommitment: "111",
                        merkleTreeRoot: "221",
                        blockNumber: 1
                    },
                    {
                        index: "2",
                        gradeCommitment: "112",
                        merkleTreeRoot: "222",
                        blockNumber: 2
                    },
                ])
            )

            const members = await testCredential.getGroupMembers("42", "grade")

            expect(members[0]).toBe("110")
            expect(members[1]).toBe("111")
            expect(members[2]).toBe("112")
        })

        it("Should return a list of credential group members", async () => {
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        merkleTreeDepth: "20",
                        zeroValue: "0"
                    }
                ])
            )
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        index: "0",
                        identityCommitment: "110",
                        merkleTreeRoot: "220",
                        blockNumber: 0
                    },
                    {
                        index: "1",
                        identityCommitment: "111",
                        merkleTreeRoot: "221",
                        blockNumber: 1
                    },
                    {
                        index: "2",
                        identityCommitment: "112",
                        merkleTreeRoot: "222",
                        blockNumber: 2
                    },
                ])
            )

            const members = await testCredential.getGroupMembers("42", "credentials")

            expect(members[0]).toBe("110")
            expect(members[1]).toBe("111")
            expect(members[2]).toBe("112")
        })

        it("Should return a list of no-credential group members", async () => {
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        merkleTreeDepth: "20",
                        zeroValue: "0"
                    }
                ])
            )
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        index: "0",
                        identityCommitment: "110",
                        merkleTreeRoot: "220",
                        blockNumber: 0
                    },
                    {
                        index: "1",
                        identityCommitment: "111",
                        merkleTreeRoot: "221",
                        blockNumber: 1
                    },
                    {
                        index: "2",
                        identityCommitment: "112",
                        merkleTreeRoot: "222",
                        blockNumber: 2
                    },
                ])
            )

            const members = await testCredential.getGroupMembers("42", "no-credentials")

            expect(members[0]).toBe("110")
            expect(members[1]).toBe("111")
            expect(members[2]).toBe("112")
        })

        it("Should throw an error if the credential does not exist", async () => {
            getEventsMocked.mockReturnValueOnce(Promise.resolve([]))

            const fun1 = () => testCredential.getGroupMembers("420", "grade")

            await expect(fun1).rejects.toThrow("Credential '420' not found")
        })

        it("Should throw an error if the group does not exist", async () => {
            getEventsMocked.mockReturnValueOnce(
                Promise.resolve([
                    {
                        merkleTreeDepth: "20",
                        zeroValue: "0"
                    }
                ])
            )

            const fun2 = () => testCredential.getGroupMembers("420", "sneed" as any) 

            await expect(fun2).rejects.toThrow("Parameter 'sneed' is not either 'grade', 'credentials', or 'no-credentials'")
        })
    })
})
