import { TestCredentialGroupsEthers, EthersOptions } from "@bq2/data"
import {
    buildPoseidon,
    decodeTestData,
    generateCredentialRestrictedTestProof,
    generateGradeRestrictedTestProof,
    generateRateCredentialIssuerProof,
    generateTestProof,
    verifyCredentialOwnershipProof,
    verifyGradeClaimProof,
    verifyTestProof,
    rootFromLeafArray,
    CredentialRestrictedTestFullProof,
    GradeRestrictedTestFullProof,
    Network,
    OpenAnswersResults,
    Poseidon,
    RateFullProof,
    SnarkArtifacts,
    SolutionSnarkArtifacts,
    TestAnswers,
    TestCredentialData,
    TestFullProof,
    TestVariables,
    DEPLOYED_CONTRACTS,
    TEST_HEIGHT,
    encodeGradeRestrictedTestFullProof,
    encodeCredentialRestrictedTestFullProof,
    encodeTestFullProof
} from "@bq2/lib"
import { Contract } from "@ethersproject/contracts"
import { keccak256 } from "@ethersproject/keccak256"
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
import { verifyProof } from "@semaphore-protocol/proof"
import CredentialRegistryABI from "./abi/CredentialsRegistryABI.json"

export default class TestCredential {
    #poseidon: Poseidon

    #testCredentialGroups: TestCredentialGroupsEthers
    #network: Network

    #credentialId: number
    #testData: TestCredentialData
    #credentialsRegistry: Contract

    #treeDepth: number
    #openAnswersHashes: string[]

    // Defines the test via its testId and the smart contract that governs it
    // @param testId Test ID of the test we are focused on.
    // @param chainId Chain ID of the network where this bqTest is defined.
    // @param credentialsContractAddress Address of the Credentials smart contract for this chainId.
    private constructor(
        poseidon: Poseidon,
        testCredentialGroups: TestCredentialGroupsEthers,
        credentialId: number,
        network: Network, 
        testData: TestCredentialData,
        credentialsRegistry: Contract,
        treeDepth: number,
        openAnswersHashes?: string[] 
    ) {
        this.#poseidon = poseidon
        this.#testCredentialGroups = testCredentialGroups
        this.#credentialId = credentialId
        this.#network = network
        this.#testData = testData
        this.#credentialsRegistry = credentialsRegistry
        this.#treeDepth = treeDepth
        this.#openAnswersHashes = openAnswersHashes ?? []
    }

    static async fetchData(
        credentialId: number,
        networkOrEthereumURL: Network = "maticmum", 
        options: EthersOptions = {},
        openAnswersHashes?: string[] 
    ) {
        let poseidon = await buildPoseidon();

        let testCredentialGroups = new TestCredentialGroupsEthers(networkOrEthereumURL, options)

        switch (networkOrEthereumURL) {
            case "maticmum":
                options.credentialsRegistryAddress = DEPLOYED_CONTRACTS.maticmum.credentialsRegistryAddress
                options.testCredentialType = DEPLOYED_CONTRACTS.maticmum.testCredentialType
                break
            default:
                if (options.credentialsRegistryAddress === undefined) {
                    throw new Error(`You should provide the Credentials Registry contract address for this network`)
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

        const credentialsRegistry = new Contract(options.credentialsRegistryAddress, CredentialRegistryABI, provider)

        const credentialType = await credentialsRegistry.getCredentialType(credentialId)

        if (options.testCredentialType !== credentialType.toString()) {
            throw new Error(`Credential ${credentialId} is not a Test Credential`)
        }

        const testData = decodeTestData(await credentialsRegistry.getCredentialData(credentialId))

        if (testData.multipleChoiceWeight !== 0 && openAnswersHashes === undefined) {
            throw new Error(`Open answers hashes need to be provided for tests that are not multiple choice`)
        }

        const treeDepth = (await credentialsRegistry.getMerkleTreeDepth(3 * credentialId)).toNumber()

        return new TestCredential(
            poseidon,
            testCredentialGroups,
            credentialId,
            networkOrEthereumURL,
            testData,
            credentialsRegistry,
            treeDepth,
            openAnswersHashes
        )
    }

    gradeSolution(testAnswers: TestAnswers) {
        // Multiple choice answers provided must be numbers and less than 64 in number
        if ( testAnswers.multipleChoiceAnswers.length > 2 ** TEST_HEIGHT ) { throw new RangeError('Surpassed maximum number of answers for a test') }
        // All open answers must be provided - even if an empty ""
        if ( testAnswers.openAnswers.length !== this.#testData.nQuestions ) { throw new RangeError('Some questions were left unanswered') }

        // Multiple choice component
        const multipleChoiceResult = this.#getMultipleChoiceResult(testAnswers)
        // Open answer component
        const { resultsArray, openAnswersResult } = this.#getOpenAnswersResult(testAnswers)

        const testResult = multipleChoiceResult + openAnswersResult

        return {
            grade: testResult,
            minimumGrade: this.#testData.minimumGrade,
            pass: testResult >= this.#testData.minimumGrade,
            nQuestions: testAnswers.openAnswers.length,
            multipleChoiceGrade: this.#testData.multipleChoiceWeight === 0 ? 0 : 100 * multipleChoiceResult / this.#testData.multipleChoiceWeight,
            openAnswerGrade: this.#testData.multipleChoiceWeight === 100 ? 0 : 100 * openAnswersResult / (100 - this.#testData.multipleChoiceWeight),
            multipleChoiceWeight: this.#testData.multipleChoiceWeight,
            openAnswerResults: resultsArray,
        }
    }

    async generateSolutionProof(
        identity: Identity, 
        testAnswers: TestAnswers,
        { testSnarkArtifacts, semaphoreSnarkArtifacts, gradeClaimSnarkArtifacts }: SolutionSnarkArtifacts
    ): Promise<TestFullProof | CredentialRestrictedTestFullProof | GradeRestrictedTestFullProof> {
        const grade = this.gradeSolution(testAnswers)

        const identityGroup = new Group(this.#credentialId, this.#treeDepth)
        const gradeGroup = new Group(this.#credentialId, this.#treeDepth)

        const testVariables: TestVariables = {
            ...this.#testData,
            minimumGrade: grade.pass ? this.#testData.minimumGrade : 0,
            openAnswersHashes: this.#openAnswersHashes
        }

        const gradeGroupMembers = await this.#testCredentialGroups.getGroupMembers(this.#credentialId, "grade")
        gradeGroup.addMembers(gradeGroupMembers)

        const identityGroupMembers = await this.#testCredentialGroups.getGroupMembers(this.#credentialId, grade.pass ? "credentials" : "no-credentials")
        identityGroup.addMembers(identityGroupMembers)

        if (this.#testData.requiredCredentialGradeThreshold !== 0) {  // Grade restricted test

            const treeDepth = (await this.#credentialsRegistry.getMerkleTreeDepth(3 * this.#testData.requiredCredential)).toNumber()
            const requiredCredentialsGradeGroup = new Group(this.#testData.requiredCredential, treeDepth)
            requiredCredentialsGradeGroup.addMembers(await this.#testCredentialGroups.getGroupMembers(this.#testData.requiredCredential, "grade"))

            const testData = decodeTestData(await this.#credentialsRegistry.getCredentialData(this.#testData.requiredCredential))

            return generateGradeRestrictedTestProof(
                identity,
                testAnswers,
                testVariables,
                identityGroup,
                gradeGroup,
                requiredCredentialsGradeGroup,
                this.#testData.requiredCredentialGradeThreshold,
                { multipleChoiceWeight: testData.multipleChoiceWeight, nQuestions: testData.nQuestions },
                grade.pass,
                testSnarkArtifacts,
                gradeClaimSnarkArtifacts                
            )

        } else if (this.#testData.requiredCredential !== 0) {  // Credential restricted test

            const treeDepth = (await this.#credentialsRegistry.getMerkleTreeDepth(3 * this.#testData.requiredCredential)).toNumber()
            const requiredCredentialsGroup = new Group(this.#testData.requiredCredential, treeDepth)
            requiredCredentialsGroup.addMembers(await this.#testCredentialGroups.getGroupMembers(this.#testData.requiredCredential, "credentials"))
            
            return generateCredentialRestrictedTestProof(
                identity,
                testAnswers,
                testVariables,
                identityGroup,
                gradeGroup,
                requiredCredentialsGroup,
                grade.pass,
                testSnarkArtifacts,
                semaphoreSnarkArtifacts
            )

        } else {  // Open test

            return generateTestProof(
                identity,
                testAnswers,
                testVariables,
                identityGroup,
                gradeGroup,
                grade.pass,
                testSnarkArtifacts
            )

        }
    }

    async verifySolutionProof(proof: TestFullProof | CredentialRestrictedTestFullProof | GradeRestrictedTestFullProof): Promise<boolean> {
        if ("gradeClaimFullProof" in proof) {  // Grade restricted test
            return (await verifyGradeClaimProof(proof.gradeClaimFullProof)) && (await verifyTestProof(proof.testFullProof))
        } else if ("semaphoreFullProof" in proof) {  // Credential restricted test
            return (await verifyCredentialOwnershipProof(proof.semaphoreFullProof)) && (await verifyTestProof(proof.testFullProof))
        } else {  // Open test
            return verifyTestProof(proof)
        }
    }

    async sendSolutionTransaction(
        proof: TestFullProof | CredentialRestrictedTestFullProof | GradeRestrictedTestFullProof,
        autotaskWebhook: string
    ): Promise<Response> {
        let credentialUpdate: string
        if ("gradeClaimFullProof" in proof) {  // Grade restricted test
            credentialUpdate = encodeGradeRestrictedTestFullProof(proof)
        } else if ("semaphoreFullProof" in proof) {  // Credential restricted test
            credentialUpdate = encodeCredentialRestrictedTestFullProof(proof)   
        } else {  // Open test
            credentialUpdate = encodeTestFullProof(proof)
        }

        return fetch(autotaskWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                abi: CredentialRegistryABI,
                functionName: "updateCredential",
                functionParameters: [this.#credentialId, credentialUpdate]
            })
        })
    }

    async generateRateIssuerProof(
        identity: Identity, 
        rating: number,
        comment: string,
        semaphoreSnarkArtifacts?: SnarkArtifacts
    ): Promise<RateFullProof> {
        const credentialsGroup = new Group(this.#credentialId, this.#treeDepth)
        const credentialsGroupMembers = await this.#testCredentialGroups.getGroupMembers(this.#credentialId, "credentials")
        credentialsGroup.addMembers(credentialsGroupMembers)

        return generateRateCredentialIssuerProof(
            identity,
            credentialsGroup,
            rating,
            comment,
            semaphoreSnarkArtifacts
        )
    }

    async verifyRateIssuerProof(proof: RateFullProof): Promise<boolean> {
        return verifyProof(proof.semaphoreFullProof, this.#treeDepth)
    }

    async sendRateIssuerTransaction(
        proof: RateFullProof,
        autotaskWebhook: string
    ): Promise<Response> {
        return fetch(autotaskWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                abi: CredentialRegistryABI,
                functionName: "updateCredential",
                functionParameters: [
                    this.#credentialId,
                    proof.semaphoreFullProof.merkleTreeRoot,
                    proof.semaphoreFullProof.nullifierHash,
                    proof.semaphoreFullProof.proof,
                    proof.rating,
                    proof.comment
                ]
            })
        })
    }

    get testCredentialData(): TestCredentialData {
        return this.#testData
    }

    get requiredCredential(): number {
        return this.#testData.requiredCredential
    }

    get requiredCredentialGradeThreshold(): number {
        return this.#testData.requiredCredentialGradeThreshold
    }

    get admin(): string {
        return this.#testData.admin
    }

    get isValid(): boolean {
        return this.#testData.minimumGrade === 255
    }

    async URI() {
        return await this.#credentialsRegistry.getCredentialURI(this.#credentialId)
    }

    async averageRating(): Promise<number> {
        return (await this.#credentialsRegistry.getCredentialAverageRating(this.#credentialId)).toNumber()
    }

    #getMultipleChoiceResult({ multipleChoiceAnswers }: TestAnswers): number {
        const answersArray = new Array(2 ** TEST_HEIGHT).fill('0')
    
        answersArray.forEach( (_, i) => {
            if ( i < multipleChoiceAnswers.length ) { 
                if (Array.isArray(multipleChoiceAnswers[i])) {
                    answersArray[i] = (multipleChoiceAnswers[i] as string[] | number[]).sort().join('')
                } else {
                    answersArray[i] = multipleChoiceAnswers[i].toString()
                }
            }
        })
        
        // Checking if test is passed and returning the result
        return rootFromLeafArray(this.#poseidon, answersArray).toString() === this.#testData.multipleChoiceRoot ? 
            this.#testData.multipleChoiceWeight : 0
    } 

    #getOpenAnswersResult = ({ openAnswers }: TestAnswers): OpenAnswersResults => {
        let nCorrect = 0
        const resultsArray = new Array(openAnswers.length).fill(false)

        for (var i = 0; i < 2 ** TEST_HEIGHT; i++) {
            if ( i < openAnswers.length ) {
                if (this.#poseidon([keccak256(openAnswers[i])]).toString() === this.#openAnswersHashes[i] ) {
                    nCorrect++
                    resultsArray[i] = true
                }
            } else {
                nCorrect++  // Default hash is always correct, simply filling to 64
            }
        }

        const openAnswersResult = (nCorrect + openAnswers.length > 64) ?  // prevent underflow
            Math.floor((100 - this.#testData.multipleChoiceWeight) * (nCorrect + openAnswers.length - 64) / openAnswers.length)
        :
            0;

        return {
            nCorrect,
            resultsArray,
            openAnswersResult
        }
    }

    // TODO: some other function to get procedurally more rating comments, from latest to earliest or opposite
    // TODO: functions to generate/verify ownership/grade claim proofs, and see if a nullifier was already used
}
