import { AxiosRequestConfig } from "axios"
import checkParameter from "./checkParameter"
import getURL from "./getURL"
import request from "./request"
import { GroupResponse, GroupOptions, Network } from "./types"

export default class BlockQualifiedSubgraph {
    private _url: string

    /**
     * Initializes the subgraph object with one of the supported networks or a custom URL.
     * @param networkOrSubgraphURL Supported Semaphore network or custom Subgraph URL.
     */
    constructor(networkOrSubgraphURL: Network | string = "maticmum") {
        checkParameter(networkOrSubgraphURL, "networkOrSubgraphURL", "string")

        if (networkOrSubgraphURL.startsWith("http")) {
            this._url = networkOrSubgraphURL
            return
        }

        this._url = getURL(networkOrSubgraphURL as Network)
    }

    /**
     * Returns the subgraph URL.
     * @returns Subgraph URL.
     */
    get url(): string {
        return this._url
    }

    /**
     * Returns a specific group.
     * @param groupId Group id.
     * @param options Options to select the group parameters.
     * @returns Specific group.
     */
    async getGroup(groupId: string): Promise<GroupResponse> {
        checkParameter(groupId, "groupId", "string")

        const config: AxiosRequestConfig = {
            method: "post",
            data: JSON.stringify({
                query: `{
                    groups(where: { id: "${groupId}" }) {
                        id
                        merkleTree {
                            root
                            depth
                            numberOfLeaves
                        }
                        members(orderBy: index) {
                            identityCommitment
                        }
                    }
                }`
            })
        }

        const { groups } = await request(this._url, config)

        groups[0].members = groups[0].members.map((member: any) => member.identityCommitment)

        return groups[0]
    }
}
