import { buildPoseidon, encodeTestCredential, hash, rootFromLeafArray } from "@bq2/lib"
import { task, types } from "hardhat/config"
import CredentialRegistryABI from "../../lib/src/abi/CredentialsRegistryABI.json"
import { readFileSync } from 'fs';

task("create-test", "Deploy the credentials contract")
    .addOptionalParam<boolean>("logs", "Print logs", false, types.boolean)
    .addPositionalParam("credentialsRegistryAddress")
    .addPositionalParam("merkleTreeDuration")
    .addPositionalParam("testHeight")
    .addPositionalParam("minimumGrade")
    .addPositionalParam("multipleChoiceWeight")
    .addPositionalParam("timeLimit")
    .addPositionalParam("admin")
    .addPositionalParam("requiredCredential")
    .addPositionalParam("requiredCredentialGradeThreshold")
    .addPositionalParam("correctAnswersFile")
    .addPositionalParam("credentialURI")
    .setAction( async( taskArgs, { ethers } ): Promise<any> => {
        let poseidon = await buildPoseidon();

        const [signer] = await ethers.getSigners()

        const credentialsRegistry = new ethers.Contract(taskArgs.credentialsRegistryAddress, CredentialRegistryABI, signer)

        let correctAnswers: { multipleChoiceAnswers: number[] | number[][], openAnswers: string[] }
        correctAnswers = require(taskArgs.correctAnswersFile) 

        const fullMultipleChoiceAnswers = new Array(2 ** taskArgs.testHeight).fill('0')
        fullMultipleChoiceAnswers.forEach( (_, i) => {
            if ( i < correctAnswers.multipleChoiceAnswers.length ) { 
                if (Array.isArray(correctAnswers.multipleChoiceAnswers[i])) {
                    fullMultipleChoiceAnswers[i] = (correctAnswers.multipleChoiceAnswers[i] as any).sort().join('')
                } else {
                    fullMultipleChoiceAnswers[i] = correctAnswers.multipleChoiceAnswers[i].toString()
                }
            }
        })
        const multipleChoiceRoot = rootFromLeafArray(poseidon, fullMultipleChoiceAnswers).toString()

        const openAnswersHashes = Array(2 ** taskArgs.testHeight).fill( poseidon([hash("")]) )
        openAnswersHashes.forEach( (_, i) => { if (i < correctAnswers.openAnswers.length) { 
            openAnswersHashes[i] = poseidon([hash(correctAnswers.openAnswers[i])])
        }})
        const openAnswersHashesRoot = rootFromLeafArray(poseidon, openAnswersHashes).toString()

        const credentialData = encodeTestCredential(
            taskArgs.testHeight,
            taskArgs.minimumGrade,
            taskArgs.multipleChoiceWeight,
            correctAnswers.openAnswers.length || 1,  // pure multiple choice tests are defined as having one question
            taskArgs.timeLimit,
            taskArgs.admin,
            taskArgs.requiredCredential,
            taskArgs.requiredCredentialGradeThreshold,
            multipleChoiceRoot,
            openAnswersHashesRoot
        )

        const tx = await credentialsRegistry.createCredential(
            16,
            0,
            taskArgs.merkleTreeDuration,
            credentialData,
            taskArgs.credentialURI
        )

        if (taskArgs.logs) {
            console.log(tx)
        }
        
        const receipt = await tx.wait()

        if (taskArgs.logs) {
            console.log(receipt)
        }
    })

// npx hardhat create-test --network maticmum 0xF12B8dAeDe57273C40b8dcD75Fa1796C21Aa2C44 0 4 50 50 0 0x408D82BB122F6cfAC6fDB60380eD2DA96dc4c5ED 0 0 "../test/answers-files/testAnswers.json" "https://twitter.com/0xdeenz" --logs true
