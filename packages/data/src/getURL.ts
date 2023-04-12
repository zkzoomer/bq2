import { Network } from "./types"

/**
 * Returns the subgraph URL related to the network passed as a parameter.
 * @param network Semaphore supported network.
 * @returns Subgraph URL.
 */
export default function getURL(network: Network): string {
    switch (network) {
        case "maticmum":
            return `https://api.thegraph.com/subgraphs/name/0xdeenz/blockqualified`
        default:
            throw new TypeError(`Network '${network}' is not supported`)
    }
}