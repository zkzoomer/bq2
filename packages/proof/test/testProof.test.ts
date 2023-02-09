import { generateTestProof, verifyTestProof, N_LEVELS, Poseidon, buildPoseidon, FullGradeCommitment, TestAnswers, TestVariables, TEST_HEIGHT, generateOpenAnswers, rootFromLeafArray, TestFullProof } from "@bq-core/proof"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import * as chai from 'chai'    
import chaiAsPromised from 'chai-as-promised'
import { utils } from "ethers"
import { getCurveFromName } from "ffjavascript"

chai.use(chaiAsPromised)

describe("Test Proof", () => {
    let poseidon: Poseidon

    const testAnswers: TestAnswers = {
        multipleChoiceAnswers: Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1),
        openAnswers: generateOpenAnswers(["chuck's", "feed", "seed"])
    }
    let testVariables: TestVariables;

    const snarkArtifacts = {
        wasmFilePath: './snark-artifacts/test.wasm',
        zkeyFilePath: `./snark-artifacts/test.zkey`
    }

    let group = new Group(0, N_LEVELS);
    let gradeGroup = new Group(0, N_LEVELS);

    const identity = new Identity("deenz")

    let fullProof: TestFullProof
    let gradeCommitmentValue: bigint

    let curve: any
    
    const expect = chai.expect

    before(async () => {
        poseidon = await buildPoseidon();

        curve = await getCurveFromName("bn128")

        const _openAnswersHashes = [
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("sneed's")))]), 
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("feed")))]), 
            poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("seed")))])
        ]
        const openAnswersHashes = Array(2 ** TEST_HEIGHT).fill( poseidon([BigInt(utils.keccak256(utils.toUtf8Bytes("")))]) )
        openAnswersHashes.forEach( (_, i) => { if (i < _openAnswersHashes.length) { openAnswersHashes[i] = _openAnswersHashes[i] }})
        
        testVariables = {
            minimumGrade: 50,
            multipleChoiceWeight: 50, 
            nQuestions: 3,
            multipleChoiceRoot: rootFromLeafArray(poseidon, Array.from({length: 2 ** TEST_HEIGHT}, (_, i) => 1)),
            openAnswersHashesRoot: rootFromLeafArray(poseidon, openAnswersHashes),
            openAnswersHashes
        }

        const expectedGrade = Math.floor(
            testVariables.multipleChoiceWeight * testVariables.nQuestions + 
            (100 - testVariables.multipleChoiceWeight) * (testVariables.nQuestions - 1)
        )

        gradeCommitmentValue = poseidon([poseidon([identity.nullifier, identity.trapdoor]), expectedGrade])
    
        /* group.addMember(group.zeroValue)
        gradeGroup.addMember(gradeGroup.zeroValue) */
    })

    after(async () => {
        await curve.terminate()
    })

    describe("generateTestProof", () => {
        it("Should not generate the test proof when providing a merkle proof and not the testId", async () => {
            let _group = new Group(0, N_LEVELS);
            let _gradeGroup = new Group(0, N_LEVELS);
            _group.addMember(_group.zeroValue)
            
            await expect(
                generateTestProof(identity, testAnswers, testVariables, _group.generateMerkleProof(0), _gradeGroup, snarkArtifacts)
            ).to.be.rejectedWith("The group ID was not provided")
            
            _group = new Group(0, N_LEVELS);
            _gradeGroup = new Group(0, N_LEVELS);
            _gradeGroup.addMember(_gradeGroup.zeroValue)

            await expect(
                generateTestProof(identity, testAnswers, testVariables, _group, _gradeGroup.generateMerkleProof(0), snarkArtifacts)
            ).to.be.rejectedWith("The group ID was not provided")
        })

        it("Should not generate a test proof with default snark artifacts with Node.js", async () => {
            await expect(
                generateTestProof(identity, testAnswers, testVariables, group, gradeGroup)
            ).to.be.rejectedWith("SNARK artifacts need to be provided")
        })

        it("Should generate a test proof passing groups as parameters", async () => {
            const _group = new Group(0, N_LEVELS);
            const _gradeGroup = new Group(0, N_LEVELS);
            
            fullProof = await generateTestProof(identity, testAnswers, testVariables, _group, _gradeGroup, snarkArtifacts)

            _group.updateMember(0, identity.commitment)
            _gradeGroup.updateMember(0, gradeCommitmentValue)

            expect(fullProof.identityCommitment).to.be.equal(identity.commitment.toString())
            expect(fullProof.gradeCommitment).to.be.equal(gradeCommitmentValue.toString())
            expect(fullProof.newIdentityTreeRoot).to.be.equal(_group.root.toString())
            expect(fullProof.newGradeTreeRoot).to.be.equal(_gradeGroup.root.toString())
        })

        it("Should generate a test proof passing merkle proofs as parameters", async () => {
            const _group = new Group(0, N_LEVELS);
            _group.addMember(_group.zeroValue)
            const _gradeGroup = new Group(0, N_LEVELS);
            _gradeGroup.addMember(_gradeGroup.zeroValue)
            
            fullProof = await generateTestProof(identity, testAnswers, testVariables, _group.generateMerkleProof(0), _gradeGroup.generateMerkleProof(0), snarkArtifacts, 0)

            _group.updateMember(0, identity.commitment)
            _gradeGroup.updateMember(0, gradeCommitmentValue)

            expect(fullProof.identityCommitment).to.be.equal(identity.commitment.toString())
            expect(fullProof.newIdentityTreeRoot).to.be.equal(_group.root.toString())
            expect(fullProof.gradeCommitment).to.be.equal(gradeCommitmentValue.toString())
            expect(fullProof.newGradeTreeRoot).to.be.equal(_gradeGroup.root.toString())
        })

        it("Should generate a test proof passing a group and a merkle proof as parameters", async () => {
            let _group = new Group(0, N_LEVELS);
            _group.addMember(_group.zeroValue)
            let _gradeGroup = new Group(0, N_LEVELS)
            
            fullProof = await generateTestProof(identity, testAnswers, testVariables, _group.generateMerkleProof(0), _gradeGroup, snarkArtifacts, 0)

            _group.updateMember(0, identity.commitment)
            _gradeGroup.updateMember(0, gradeCommitmentValue)

            expect(fullProof.identityCommitment).to.be.equal(identity.commitment.toString())
            expect(fullProof.newIdentityTreeRoot).to.be.equal(_group.root.toString())
            expect(fullProof.gradeCommitment).to.be.equal(gradeCommitmentValue.toString())
            expect(fullProof.newGradeTreeRoot).to.be.equal(_gradeGroup.root.toString())
            
            _group = new Group(0, N_LEVELS);
            _gradeGroup = new Group(0, N_LEVELS)
            _gradeGroup.addMember(_gradeGroup.zeroValue)

            fullProof = await generateTestProof(identity, testAnswers, testVariables, _group, _gradeGroup.generateMerkleProof(0), snarkArtifacts, 0)

            _group.updateMember(0, identity.commitment)
            _gradeGroup.updateMember(0, gradeCommitmentValue)

            expect(fullProof.identityCommitment).to.be.equal(identity.commitment.toString())
            expect(fullProof.newIdentityTreeRoot).to.be.equal(_group.root.toString())
            expect(fullProof.gradeCommitment).to.be.equal(gradeCommitmentValue.toString())
            expect(fullProof.newGradeTreeRoot).to.be.equal(_gradeGroup.root.toString())
        })
    })

    describe("verifyTestProof", () => {
        it("Should verify a test proof", async () => {
            const response = await verifyTestProof(fullProof)
        
            expect(response).to.be.true
        })
    })
})
