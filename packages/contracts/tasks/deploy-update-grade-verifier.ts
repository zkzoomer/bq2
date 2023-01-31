import { task, types } from "hardhat/config"

task("deploy:update-grade-verifier", "Deploy the grade update verifier contract")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                pairing: pairingAddress,
            },
            { ethers }
        ): Promise<any> => {    
            const UpdateGradeVerifierFactory = await ethers.getContractFactory("UpdateGradeVerifier")

            const updateGradeVerifier = await UpdateGradeVerifierFactory.deploy()

            await updateGradeVerifier.deployed()

            if (logs) {
                console.info(`UpdateGradeVerifier contract has been deployed to: ${updateGradeVerifier.address}`)
            }

            return {
                updateGradeVerifier,
                pairingAddress
            }
        }
    )
