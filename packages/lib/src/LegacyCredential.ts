import { EthersOptions } from "@bq2/data"
import {
    buildPoseidon,
    decodeLegacyCredentialData,
    Network,
    Poseidon,
    DEPLOYED_CONTRACTS,
    LegacyCredentialRecipient,
    encodeLegacyCredential,
} from "@bq2/lib"
import { Signer } from "@ethersproject/abstract-signer"
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
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import CredentialRegistryABI from "./abi/CredentialsRegistryABI.json"

export default class LegacyCredential {
    #poseidon: Poseidon

    #credentialId: number
    #credentialsRegistry: Contract
    #minimumGrade: number

    #gradeGroup: Group
    #credentialsGroup: Group
    #noCredentialsGroup: Group

    // Defines the test via its testId and the smart contract that governs it
    // @param testId Test ID of the test we are focused on.
    // @param chainId Chain ID of the network where this bqTest is defined.
    // @param credentialsContractAddress Address of the Credentials smart contract for this chainId.
    private constructor(
        poseidon: Poseidon,
        credentialId: number,
        credentialsRegistry,
        minimumGrade,
        gradeGroup: Group,
        credentialsGroup: Group,
        noCredentialsGroup: Group
    ) {
        this.#poseidon = poseidon
        this.#credentialId = credentialId
        this.#credentialsRegistry = credentialsRegistry
        this.#minimumGrade = minimumGrade
        this.#gradeGroup = gradeGroup
        this.#credentialsGroup = credentialsGroup
        this.#noCredentialsGroup = noCredentialsGroup
    }

    // Spins up a new Legacy Credential
    static async new(
        credentialId: number,
        treeDepth: number,
        merkleTreeDuration: number,
        credentialURI: string,
        minimumGrade: number,
        legacyCredentialRecipients: LegacyCredentialRecipient[],
        signer: Signer,
        options: EthersOptions = {},
        networkOrEthereumURL: Network = "maticmum"
    ) {
        let poseidon = await buildPoseidon();

        switch (networkOrEthereumURL) {
            case "maticmum":
                options.credentialsRegistryAddress = DEPLOYED_CONTRACTS.maticmum.credentialsRegistryAddress
                options.legacyCredentialType = DEPLOYED_CONTRACTS.maticmum.testCredentialType
                break
            default:
                if (options.credentialsRegistryAddress === undefined) {
                    throw new Error(`You should provide the Credentials Registry contract address for this network`)
                }

                if (options.legacyCredentialType === undefined) {
                    options.legacyCredentialType = 1
                }
        }

        const credentialsRegistry = new Contract(options.credentialsRegistryAddress, CredentialRegistryABI, signer)

        const credentialExists = await credentialsRegistry.credentialExists(credentialId)

        if (credentialExists) {
            throw new Error(`Credential #${credentialId} already exists`)
        }

        let gradeGroupMembers: string[] = []
        let credentialsGroupMembers: string[] = []
        let noCredentialsGroupMembers: string[] = []

        legacyCredentialRecipients.forEach( (recipient) => {
            const { trapdoor, nullifier, commitment } = new Identity(recipient.userSecret)
            
            gradeGroupMembers.push(poseidon([poseidon([nullifier, trapdoor]), recipient.grade]).toString())
            if (recipient.grade >= minimumGrade) {
                credentialsGroupMembers.push(commitment.toString())
            } else {
                noCredentialsGroupMembers.push(commitment.toString())
            }
        })

        let gradeGroup = new Group(credentialId)
        let credentialsGroup = new Group(credentialId)
        let noCredentialsGroup = new Group(credentialId)

        gradeGroup.addMembers(gradeGroupMembers)
        credentialsGroup.addMembers(credentialsGroupMembers)
        noCredentialsGroup.addMembers(noCredentialsGroupMembers)

        const credentialData = encodeLegacyCredential(
            gradeGroupMembers.length,
            credentialsGroupMembers.length,
            noCredentialsGroupMembers.length,
            gradeGroup.root.toString(),
            credentialsGroup.root.toString(),
            noCredentialsGroup.root.toString(),
            minimumGrade
        )

        // Create the new credential on-chain
        const tx = await credentialsRegistry.createCredential(
            credentialId,
            treeDepth,
            options.legacyCredentialType,
            merkleTreeDuration,
            credentialData,
            credentialURI
        )

        await tx.wait()

        return new LegacyCredential(
            poseidon,
            credentialId,
            credentialsRegistry,
            minimumGrade,
            gradeGroup,
            credentialsGroup,
            noCredentialsGroup
        )
    }

    // Loads a Legacy Credential
    static async load(
        credentialId: number,
        gradeGroup: Group,
        credentialsGroup: Group,
        noCredentialsGroup: Group,
        signer: Signer,
        options: EthersOptions = {},
        networkOrEthereumURL: Network = "maticmum", 
    ) {
        let poseidon = await buildPoseidon();

        switch (networkOrEthereumURL) {
            case "maticmum":
                options.credentialsRegistryAddress = DEPLOYED_CONTRACTS.maticmum.credentialsRegistryAddress
                options.legacyCredentialType = DEPLOYED_CONTRACTS.maticmum.testCredentialType
                break
            default:
                if (options.credentialsRegistryAddress === undefined) {
                    throw new Error(`You should provide the Credentials Registry contract address for this network`)
                }

                if (options.legacyCredentialType === undefined) {
                    options.legacyCredentialType = 1
                }
        }

        const credentialsRegistry = new Contract(options.credentialsRegistryAddress, CredentialRegistryABI, signer)

        let credentialType;
        try {
            credentialType = await credentialsRegistry.getCredentialType(credentialId)
        } catch (_) {
            throw new Error(`Credential #${credentialId} does not exist`)
        }

        if (options.legacyCredentialType !== credentialType.toNumber()) {
            throw new Error(`Credential #${credentialId} is not a Legacy Credential`)
        }

        const credentialAdmin = await credentialsRegistry.getCredentialAdmin(credentialId)
        const signerAddress = await signer.getAddress()

        if (signerAddress !== credentialAdmin) {
            throw new Error(`Signer provided is not the credential admin ${credentialAdmin}`)
        }

        const credentialData = decodeLegacyCredentialData(await credentialsRegistry.getCredentialData(credentialId))

        // Verify that the groups given correspond to those on-chain
        // Don't really need to check that the number of leaves is correct, as it gets encoded in the root
        if (gradeGroup.root.toString() !== credentialData.credentialState.gradeTreeRoot) {
            throw new Error("Grade group provided does not match with the on-chain root")
        }
        if (credentialsGroup.root.toString() !== credentialData.credentialState.credentialsTreeRoot) {
            throw new Error("Credentials group provided does not match with the on-chain root")
        }
        if (noCredentialsGroup.root.toString() !== credentialData.credentialState.noCredentialsTreeRoot) {
            throw new Error("No-credentials group provided does not match with the on-chain root")
        }

        return new LegacyCredential(
            poseidon,
            credentialId,
            credentialsRegistry,
            credentialData.minimumGrade,
            gradeGroup,
            credentialsGroup,
            noCredentialsGroup
        )
    }

    // updates the given user secret to an actual identity commitment
    setNewUserIdentity(
        legacyCredentialRecipient: LegacyCredentialRecipient,
        newIdentity: Identity
    ) {    
        const oldIdentity = new Identity(legacyCredentialRecipient.userSecret)
        
        const gradeIndex = this.#gradeGroup.indexOf(
            this.#poseidon([this.#poseidon([oldIdentity.nullifier, oldIdentity.trapdoor]), legacyCredentialRecipient.grade])
        )

        if (gradeIndex === -1) {
            throw new Error("Recipient was not found")
        }

        this.#gradeGroup.updateMember( 
            gradeIndex,
            this.#poseidon([this.#poseidon([newIdentity.nullifier, newIdentity.trapdoor]), legacyCredentialRecipient.grade])
        )

        if (legacyCredentialRecipient.grade >= this.#minimumGrade) {
            const credentialIndex = this.#credentialsGroup.indexOf(oldIdentity.commitment)
    
            this.#credentialsGroup.updateMember( 
                credentialIndex,
                newIdentity.commitment
            )
        } else {
            const noCredentialsIndex = this.#noCredentialsGroup.indexOf(oldIdentity.commitment)
    
            this.#noCredentialsGroup.updateMember( 
                noCredentialsIndex,
                newIdentity.commitment
            )
        }
    }

    addCredentialRecipient(
        legacyCredentialRecipient: LegacyCredentialRecipient
    ) {
        const { trapdoor, nullifier, commitment } = new Identity(legacyCredentialRecipient.userSecret)
        
        this.#gradeGroup.addMember(
            this.#poseidon([this.#poseidon([nullifier, trapdoor]), legacyCredentialRecipient.grade]).toString()
        )

        if (legacyCredentialRecipient.grade >= this.#minimumGrade) {
            this.#credentialsGroup.addMember(
                commitment.toString()
            )
        } else {
            this.#noCredentialsGroup.addMember(
                commitment.toString()
            )
        }
    }

    async publishChanges() {
        const currentData = decodeLegacyCredentialData(await this.#credentialsRegistry.getCredentialData(this.#credentialId))

        if (
            this.#gradeGroup.root.toString() === currentData.credentialState.gradeTreeRoot &&
            this.#credentialsGroup.root.toString() === currentData.credentialState.credentialsTreeRoot &&
            this.#noCredentialsGroup.root.toString() === currentData.credentialState.noCredentialsTreeRoot
        ) {
            throw new Error("Cannot publish changes as no changes were made")
        }

        const credentialUpdate = encodeLegacyCredential(
            this.#gradeGroup.members.length,
            this.#credentialsGroup.members.length,
            this.#noCredentialsGroup.members.length,
            this.#gradeGroup.root.toString(),
            this.#credentialsGroup.root.toString(),
            this.#noCredentialsGroup.root.toString(),
        )

        // Publish changes on-chain
        const tx = await this.#credentialsRegistry.updateCredential(
            this.#credentialId,
            credentialUpdate
        )

        await tx.wait()
    }

    get gradeGroup(): Group {
        return this.#gradeGroup
    }

    get credentialsGroup(): Group {
        return this.#credentialsGroup
    }

    get noCredentialsGroup(): Group {
        return this.#noCredentialsGroup
    }
    
    async URI(): Promise<string> {
        return await this.#credentialsRegistry.getCredentialURI(this.#credentialId)
    }

    async averageRating(): Promise<number> {
        return (await this.#credentialsRegistry.getCredentialAverageRating(this.#credentialId)).toNumber()
    }
}
