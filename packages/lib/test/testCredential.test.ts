import {
    buildPoseidon,
    generateOpenAnswers,
    generateTestProof,
    hash,
    BigNumberish,
    TestCredential,
    Poseidon,
    MAX_TREE_DEPTH,
} from "@bq2/lib"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { config as dotenvConfig } from "dotenv"
import { getCurveFromName } from "ffjavascript"
import { resolve } from "path"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

const TEST_HEIGHT = 4;

dotenvConfig({ path: resolve(__dirname, "../../../.env") })

const testSnarkArtifacts = {
    wasmFilePath: `../snark-artifacts/test${TEST_HEIGHT}.wasm`,
    zkeyFilePath: `../snark-artifacts/test${TEST_HEIGHT}.zkey`
}/* 
const gradeClaimSnarkArtifacts = {
    wasmFilePath: '../snark-artifacts/gradeClaim.wasm',
    zkeyFilePath: `../snark-artifacts/gradeClaim.zkey`
}
const semaphoreSnarkArtifacts = {
    wasmFilePath: '../snark-artifacts/semaphore.wasm',
    zkeyFilePath: `../snark-artifacts/semaphore.zkey`
} */

describe("TestCredential", () => {
    let poseidon: Poseidon
    let curve: any

    const credentialId = 1

    let identity: Identity
    let testCredential: TestCredential

    let multipleChoiceAnswers: number[]
    let openAnswers: string[]
    let openAnswersHashes: BigNumberish[];

    const expect = chai.expect

    let gradeCommitment: bigint;

    before(async () =>  {
        poseidon = await buildPoseidon();

        curve = await getCurveFromName("bn128")

        identity = new Identity("deenz")

        multipleChoiceAnswers = Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1)
        openAnswers = generateOpenAnswers(["sneed's", "feed", "seed"], TEST_HEIGHT)

        openAnswersHashes = [
            poseidon([hash("sneed's")]), 
            poseidon([hash("feed")]), 
            poseidon([hash("seed")])
        ]

        gradeCommitment = poseidon([poseidon([identity.nullifier, identity.trapdoor]), 100])
    })
    
    after(async () => {
        await curve.terminate()
    })

    context("when defining a new TestCredential object", () => {
        describe("init", () => {
            it("should return a new TestCredential object", async () => {
                testCredential = await TestCredential.init(
                    credentialId,
                    "maticmum",
                    {
                        provider: "alchemy",
                        apiKey: process.env.ALCHEMY_API_KEY
                    },
                    openAnswersHashes,
                )

                expect(testCredential).to.be.instanceOf(Object)
            })
        })
    })

    context("after defining a TestCredential object", () => {
        describe("sendSolutionTransaction", () => {
            it("sends a request to the relayer that will post the transaction", async () => {
                // const proof = await testCredential.generateSolutionProof(
                //    identity,
                //    { multipleChoiceAnswers, openAnswers },
                //    { testSnarkArtifacts, semaphoreSnarkArtifacts, gradeClaimSnarkArtifacts }
                // )
                
                const fullOpenAnswersHashes = Array(2 ** TEST_HEIGHT).fill( poseidon([hash("")]) )
                fullOpenAnswersHashes.forEach( (_, i) => { if (i < openAnswersHashes.length) { fullOpenAnswersHashes[i] = openAnswersHashes[i] }})

                const testVariables = {
                    ...testCredential.testCredentialData,
                    openAnswersHashes: fullOpenAnswersHashes
                }

                const identityGroup = new Group(credentialId, MAX_TREE_DEPTH)
                const gradeGroup = new Group(credentialId, MAX_TREE_DEPTH)

                const nLeaves = await testCredential.getNumberOfMerkleTreeLeaves("credentials")

                identityGroup.addMembers(new Array(nLeaves).fill(identity.commitment))
                gradeGroup.addMembers(new Array(nLeaves).fill(gradeCommitment))

                const proof = await generateTestProof(
                    identity,
                    { multipleChoiceAnswers, openAnswers },
                    testVariables,
                    identityGroup,
                    gradeGroup,
                    true,
                    testSnarkArtifacts
                )
                
                // Proof is valid
                expect(await testCredential.verifySolutionProof(proof)).to.be.equal(true)
                
                // Gets sent to relayer
                const response = await testCredential.sendSolutionTransaction(proof)

                // Relayer is successful
                expect(response.status).to.be.equal(200)
            })
        })

        /* describe("sendRateIssuerTransaction", () => {
            it("sends a request to the relayer that will post the transaction", () => {
                    
            })
        }) */
    })
}) 