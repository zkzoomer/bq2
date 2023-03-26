import { encodeTestInitializingParameters } from "@bq2/lib"
import { task, types } from "hardhat/config"
import CredentialRegistryABI from "../../lib/src/abi/CredentialsRegistryABI.json"

task("create-test", "Deploy the credentials contract")
    .addOptionalParam<boolean>("logs", "Print logs", false, types.boolean)
    .addPositionalParam("credentialsRegistryAddress")
    .addPositionalParam("treeDepth")
    .addPositionalParam("testCredentialManagerType")
    .addPositionalParam("merkleTreeDuration")
    .addPositionalParam("minimumGrade")
    .addPositionalParam("multipleChoiceWeight")
    .addPositionalParam("nQuestions")
    .addPositionalParam("timeLimit")
    .addPositionalParam("admin")
    .addPositionalParam("requiredCredential")
    .addPositionalParam("requiredCredentialGradeThreshold")
    .addPositionalParam("multipleChoiceRoot")
    .addPositionalParam("openAnswersHashesRoot")
    .addPositionalParam("credentialURI")
    .setAction( async( taskArgs, { ethers } ): Promise<any> => {
        const [signer] = await ethers.getSigners()

        const credentialsRegistry = new ethers.Contract(taskArgs.credentialsRegistryAddress, CredentialRegistryABI, signer)

        const credentialData = encodeTestInitializingParameters(
            taskArgs.minimumGrade,
            taskArgs.multipleChoiceWeight,
            taskArgs.nQuestions,
            taskArgs.timeLimit,
            taskArgs.admin,
            taskArgs.requiredCredential,
            taskArgs.requiredCredentialGradeThreshold,
            taskArgs.multipleChoiceRoot,
            taskArgs.openAnswersHashesRoot
        )

        const tx = await credentialsRegistry.createCredential(
            taskArgs.treeDepth,
            taskArgs.testCredentialManagerType,
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

// npx hardhat create-test --network mumbai 0x835a8EEF0fCeC907F1aA9aCe4B527ecFA4475c0C 16 0 0 50 50 3 0 0x408D82BB122F6cfAC6fDB60380eD2DA96dc4c5ED 0 0 1048354070873957666044035611222378271268050769497104695048579734664513 156633770684961726928153301439159592003253281283828622825126460245699167 "https://twitter.com/0xdeenz" --logs true
