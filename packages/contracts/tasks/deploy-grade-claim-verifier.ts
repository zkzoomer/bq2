import { task, types } from "hardhat/config"

task("deploy:grade-claim-verifier", "Deploy the grade claim verifier contract")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .addOptionalParam<boolean>("pairing", "Pairing library address", undefined, types.string)
    .setAction(
        async (
            {
                logs,
                pairing: pairing,
            },
            { ethers }
        ): Promise<any> => {    
            if (!pairing) {
                const PairingFactory = await ethers.getContractFactory("@semaphore-protocol/contracts/base/Pairing.sol:Pairing")
                pairing = await PairingFactory.deploy()

                await pairing.deployed()

                if (logs) {
                    console.info(`Pairing library has been deployed to: ${pairing.address}`)
                }
            }

            const GradeClaimVerifierFactory = await ethers.getContractFactory("GradeClaimVerifier"/* , {
                libraries: {
                    Pairing: pairing.address
                }
            } */)

            const gradeClaimVerifier = await GradeClaimVerifierFactory.deploy()

            await gradeClaimVerifier.deployed()

            if (logs) {
                console.info(`GradeClaimVerifier contract has been deployed to: ${gradeClaimVerifier.address}`)
            }

            return {
                gradeClaimVerifier,
                pairing,
            }
        }
    )
