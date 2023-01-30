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
            if (!pairingAddress) {
                const PairingFactory = await ethers.getContractFactory("Pairing")
                const pairing = await PairingFactory.deploy()

                await pairing.deployed()

                if (logs) {
                    console.info(`Pairing library has been deployed to: ${pairing.address}`)
                }

                pairingAddress = pairing.address
            }

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
