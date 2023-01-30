import { task, types } from "hardhat/config"

task("deploy:grade-update-verifier", "Deploy the grade update verifier contract")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                pairing: pairingAddress,
            },
            { ethers }
        ): Promise<any> => {    
            const GradeUpdateVerifierFactory = await ethers.getContractFactory("GradeUpdateVerifier")

            const gradeUpdateVerifier = await GradeUpdateVerifierFactory.deploy()

            await gradeUpdateVerifier.deployed()

            if (logs) {
                console.info(`GradeUpdateVerifier contract has been deployed to: ${gradeUpdateVerifier.address}`)
            }

            return {
                gradeUpdateVerifier,
                pairingAddress
            }
        }
    )
