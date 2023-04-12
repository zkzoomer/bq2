import getURL from "../getURL"
import request from "../request"
import BlockQualifiedSubgraph from "../subgraph"

jest.mock("../request", () => ({
    __esModule: true,
    default: jest.fn()
}))

const requestMocked = request as jest.MockedFunction<typeof request>

describe("BlockQualifiedSubgraph", () => {
    let blockQualified: BlockQualifiedSubgraph

    describe("# BlockQualifiedSubgraph", () => {
        it("Should instantiate a BlockQualifiedSubgraph object", () => {
            blockQualified = new BlockQualifiedSubgraph()

            expect(blockQualified.url).toContain(getURL("maticmum"))
        })

        it("Should instantiate a BlockQualifiedSubgraph object using URL", () => {
            const url = "https://api.studio.thegraph.com/query/somethingsomething"
            const blockQualified1 = new BlockQualifiedSubgraph(url)

            expect(blockQualified1.url).toBe(url)
        })

        it("Should throw an error if there is a wrong network", () => {
            const fun = () => new BlockQualifiedSubgraph("wrong" as any)

            expect(fun).toThrow("Network 'wrong' is not supported")
        })

        it("Should throw an error if the networkOrSubgraphURL parameter type is wrong", () => {
            const fun = () => new BlockQualifiedSubgraph(33 as any)

            expect(fun).toThrow("Parameter 'networkOrSubgraphURL' is not a string")
        })
    })
    
    describe("# getGroup", () => {
        it("Should throw an error if the credentialId parameter type is wrong", async () => {
            const fun = () => blockQualified.getGroup("1" as any, "grade")

            await expect(fun).rejects.toThrow("Parameter 'credentialId' is not a number")
        })

        it("Should throw an error if the group parameter type is wrong", async () => {
            const fun = () => blockQualified.getGroup(1, "no-grade" as any)

            await expect(fun).rejects.toThrow("Group 'no-grade' is not valid")
        })

        it("Should return a specific group with its members", async () => {
            requestMocked.mockImplementationOnce(() =>
                Promise.resolve({
                    groups: [
                        {
                            id: "1",
                            merkleTree: {
                                depth: 20,
                                numberOfLeaves: 2,
                                root: "2"
                            },
                            members: [
                                {
                                    identityCommitment: "1"
                                },
                                {
                                    identityCommitment: "2"
                                }
                            ]
                        }
                    ]
                })
            )

            const expectedValue = await blockQualified.getGroup(1, "grade")

            expect(expectedValue).toBeDefined()
            expect(expectedValue).toEqual({
                id: "1",
                merkleTree: {
                    depth: 20,
                    numberOfLeaves: 2,
                    root: "2"
                },
                members: ["1", "2"]
            })
        })
    })
})