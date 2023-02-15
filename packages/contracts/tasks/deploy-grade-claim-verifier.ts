import { task, types } from "hardhat/config"

task("deploy:grade-claim-verifier", "Deploy the grade claim verifier contract")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                pairing: pairingAddress
            },
            { ethers }
        ): Promise<any> => {    
            if (!pairingAddress) {
                const PairingFactory = await ethers.getContractFactory("contracts/lib/Pairing.sol:Pairing")
                const pairing = await PairingFactory.deploy()

                await pairing.deployed()

                if (logs) {
                    console.info(`Pairing library has been deployed to: ${pairing.address}`)
                }

                pairingAddress = pairing.address
            }
            
            const GradeClaimVerifierFactory = await ethers.getContractFactory("GradeClaimVerifier", {
                libraries: {
                    Pairing: pairingAddress
                }
            })

            const gradeClaimVerifier = await GradeClaimVerifierFactory.deploy()

            await gradeClaimVerifier.deployed()

            if (logs) {
                console.info(`GradeClaimVerifier contract has been deployed to: ${gradeClaimVerifier.address}`)
            }

            return {
                gradeClaimVerifier,
                pairingAddress,
            }
        }
    )
