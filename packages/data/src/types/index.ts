export type Network =
    | "homestead"
    | "maticmum"

export type GroupOptions = {
    members?: boolean
    filters?: {
        timestamp?: Date
        timestampGte?: Date
        timestampLte?: Date
    }
}

export type GroupResponse = {
    id: string
    merkleTree: {
        root: string
        depth: number
        numberOfLeaves: number
    }
    members?: string[]
}

export type EthersOptions = {
    credentialsRegistryAddress?: string
    credentialsRegistryStartBlock?: number
    testCredentialManagerAddress?: string
    testCredentialManagerStartBlock?: number
    testCredentialType?: number
    legacyCredentialManagerAddress?: string
    legacyCredentialManagerStartBlock?: number
    legacyCredentialType?: number
    provider?: "etherscan" | "infura" | "alchemy" | "cloudflare" | "pocket" | "ankr"
    apiKey?: string
    autotaskWebhook?: string
}
