import { task, types } from "hardhat/config"

task("deploy:grade-claim-verifier", "Deploy the grade claim verifier contract")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                pairingLib: pairingLibAddress,
            },
            { ethers }
        ): Promise<any> => {    
            const GradeClaimVerifierFactory = await ethers.getContractFactory("GradeClaimVerifier")

            const gradeClaimVerifier = await GradeClaimVerifierFactory.deploy()

            await gradeClaimVerifier.deployed()

            if (logs) {
                console.info(`GradeClaimVerifier contract has been deployed to: ${gradeClaimVerifier.address}`)
            }

            return {
                gradeClaimVerifier,
                pairingLibAddress,
            }
        }
    )
