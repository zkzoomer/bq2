import { Contract } from "@ethersproject/contracts"
import {
    AlchemyProvider,
    AnkrProvider,
    CloudflareProvider,
    EtherscanProvider,
    InfuraProvider,
    JsonRpcProvider,
    PocketProvider,
    Provider
} from "@ethersproject/providers"
import checkParameter from "./checkParameter"
import getEvents from "./getEvents"
import CredentialsRegistryABI from "./abi/CredentialsRegistryABI.json"
import TestCredentialManagerABI from "./abi/TestCredentialManagerABI.json"
import { EthersOptions, GroupResponse, Network } from "./types"

export default class TestCredentialGroupsEthers {
    private _network: Network | string
    private _options: EthersOptions
    private _credentialsRegistryContract: Contract
    private _testCredentialManagerContract: Contract
    private _testCredentialType: number

    /**
     * Initializes the Ethers object with an Ethereum network or custom URL.
     * @param networkOrEthereumURL Ethereum network or custom URL.
     * @param options Ethers options.
     */
    constructor(networkOrEthereumURL: Network | string = "maticmum", options: EthersOptions = {}) {
        checkParameter(networkOrEthereumURL, "networkOrSubgraphURL", "string")

        if (options.provider) {
            checkParameter(options.provider, "provider", "string")
        } else if (!networkOrEthereumURL.startsWith("http")) {
            options.provider = "infura"
        }

        if (options.apiKey) {
            checkParameter(options.apiKey, "apiKey", "string")
        }

        switch (networkOrEthereumURL) {
            case "maticmum":
                options.credentialsRegistryAddress = "0x835a8EEF0fCeC907F1aA9aCe4B527ecFA4475c0C"
                options.credentialsRegistryStartBlock = 33597464
                options.testCredentialManagerAddress = "0xAE4f50B84e9600C0d038CE046225B9767857d68B"
                options.testCredentialManagerStartBlock = 33597464 
                options.testCredentialType = 0
                break
            default:
                if (options.credentialsRegistryAddress === undefined || options.testCredentialManagerAddress === undefined) {
                    throw new Error(`You should provide contract addresses for this network`)
                }

                if (options.credentialsRegistryStartBlock === undefined) {
                    options.credentialsRegistryStartBlock = 0
                }

                if (options.testCredentialManagerStartBlock === undefined) {
                    options.testCredentialManagerStartBlock = 0
                }

                if (options.testCredentialType === undefined) {
                    options.testCredentialType = 0
                }
        }

        let provider: Provider

        switch (options.provider) {
            case "infura":
                provider = new InfuraProvider(networkOrEthereumURL, options.apiKey)
                break
            case "alchemy":
                provider = new AlchemyProvider(networkOrEthereumURL, options.apiKey)
                break
            case "cloudflare":
                provider = new CloudflareProvider(networkOrEthereumURL, options.apiKey)
                break
            case "etherscan":
                provider = new EtherscanProvider(networkOrEthereumURL, options.apiKey)
                break
            case "pocket":
                provider = new PocketProvider(networkOrEthereumURL, options.apiKey)
                break
            case "ankr":
                provider = new AnkrProvider(networkOrEthereumURL, options.apiKey)
                break
            default:
                if (!networkOrEthereumURL.startsWith("http")) {
                    throw new Error(`Provider '${options.provider}' is not supported`)
                }

                provider = new JsonRpcProvider(networkOrEthereumURL)
        }

        this._network = networkOrEthereumURL
        this._options = options
        this._credentialsRegistryContract = new Contract(options.credentialsRegistryAddress, CredentialsRegistryABI, provider)
        this._testCredentialManagerContract = new Contract(options.testCredentialManagerAddress, TestCredentialManagerABI, provider)
        this._testCredentialType = options.testCredentialType
    }

    /**
     * Returns the Ethereum network or custom URL.
     * @returns Ethereum network or custom URL.
     */
    get network(): Network | string {
        return this._network
    }

    /**
     * Returns the Ethers options.
     * @returns Ethers options.
     */
    get options(): EthersOptions {
        return this._options
    }

    /**
     * Returns the Credentials Registry contract object.
     * @returns Contract object.
     */
    get credentialsRegistryContract(): Contract {
        return this._credentialsRegistryContract
    }

    /**
     * Returns the Test Credential Manager contract object.
     * @returns Contract object.
     */
    get testCredentialManagerContract(): Contract {
        return this._testCredentialManagerContract
    }

    /**
     * Returns the list of test credential ids.
     * @returns List of test credential ids.
     */
    async getCredentialIds(): Promise<string[]> {
        const credentials = await getEvents(this._credentialsRegistryContract, "CredentialCreated", [], this._options.credentialsRegistryStartBlock)

        return credentials.filter((event: any) => event[1].toString() === this._testCredentialType.toString()).map((event: any) => event[0].toString())
    }

    /**
     * Returns a specific group.
     * @param credentialId Credential id.
     * @param subgroup Group being fetched.
     * @returns Specific group.
     */
    async getGroup(credentialId: number, subgroup: "grade" | "credentials" | "no-credentials"): Promise<GroupResponse> {
        checkParameter(credentialId, "credentialId", "number")

        let groupId: string

        switch (subgroup) {
            case "grade":
                groupId = (3 * (credentialId - 1) + 1).toString()
                break
            case "credentials":
                groupId = (3 * (credentialId - 1) + 2).toString()
                break
            case "no-credentials":
                groupId = (3 * (credentialId - 1) + 3).toString()
                break
            default:
                throw new TypeError(`Parameter '${subgroup}' is not either 'grade', 'credentials', or 'no-credentials'`)
        }

        const [groupCreatedEvent] = await getEvents(
            this._credentialsRegistryContract, 
            "CredentialCreated", 
            [credentialId], 
            this._options.credentialsRegistryStartBlock
        )

        if (!groupCreatedEvent) {
            throw new Error(`Credential '${credentialId}' not found`)
        }

        const merkleTreeRoot = await this._credentialsRegistryContract.getMerkleTreeRoot(groupId)
        const numberOfLeaves = await this._credentialsRegistryContract.getNumberOfMerkleTreeLeaves(groupId)

        const group: GroupResponse = {
            id: groupId.toString(),
            merkleTree: {
                depth: groupCreatedEvent.merkleTreeDepth.toString(),
                numberOfLeaves: numberOfLeaves.toNumber(),
                root: merkleTreeRoot.toString()
            }
        }

        return group
    }

    /**
     * Returns a list of group members.
     * @param credentialId Credential id.
     * @param subgroup Group being fetched.
     * @returns Group members.
     */
    async getGroupMembers(credentialId: number, subgroup: "grade" | "credentials" | "no-credentials"): Promise<string[]> {
        checkParameter(credentialId, "credentialId", "number")

        const [groupCreatedEvent] = await getEvents(
            this._credentialsRegistryContract, 
            "CredentialCreated", 
            [credentialId], 
            this._options.credentialsRegistryStartBlock
        )

        if (!groupCreatedEvent) {
            throw new Error(`Credential '${credentialId}' not found`)
        }

        let groupId: string
        let memberAddedEvents: any[]
        const members: string[] = []

        switch (subgroup) {
            case "grade":
                groupId = (3 * (credentialId - 1) + 1).toString()

                memberAddedEvents = await getEvents(
                    this._testCredentialManagerContract,
                    "GradeMemberAdded",
                    [credentialId],
                    this._options.testCredentialManagerStartBlock
                )

                for (const { gradeCommitment } of memberAddedEvents) {
                    members.push(gradeCommitment.toString())
                }

                break
            case "credentials":
                groupId = (3 * (credentialId - 1) + 2).toString()

                memberAddedEvents = await getEvents(
                    this._testCredentialManagerContract,
                    "CredentialsMemberAdded",
                    [credentialId],
                    this._options.testCredentialManagerStartBlock
                )

                for (const { identityCommitment } of memberAddedEvents) {
                    members.push(identityCommitment.toString())
                }

                break
            case "no-credentials":
                groupId = (3 * (credentialId - 1) + 3).toString()

                memberAddedEvents = await getEvents(
                    this._testCredentialManagerContract,
                    "NoCredentialsMemberAdded",
                    [credentialId],
                    this._options.testCredentialManagerStartBlock
                )

                for (const { identityCommitment } of memberAddedEvents) {
                    members.push(identityCommitment.toString())
                }

                break
            default:
                throw new TypeError(`Parameter '${subgroup}' is not either 'grade', 'credentials', or 'no-credentials'`)
        }

        return members
    }
}
