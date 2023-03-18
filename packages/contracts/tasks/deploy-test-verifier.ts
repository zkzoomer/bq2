import { task, types } from "hardhat/config"

task("deploy:test-verifier", "Deploy the test verifier contract")
    .addOptionalParam<boolean>("pairing", "Pairing library address", undefined, types.string)
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                pairingLib: pairingLib,
            },
            { ethers }
        ): Promise<any> => {
            if (!pairingLib) {
                const PairingLibFactory = await ethers.getContractFactory("PairingLib")
                pairingLib = await PairingLibFactory.deploy()

                await pairingLib.deployed()

                if (logs) {
                    console.info(`Pairing library has been deployed to: ${pairingLib.address}`)
                }
            }

            const TestVerifierFactory = await ethers.getContractFactory("TestVerifier"/* , {
                libraries: {
                    PairingLib: pairingLib.address
                }
            } */)

            const testVerifier = await TestVerifierFactory.deploy()

            await testVerifier.deployed()

            if (logs) {
                console.info(`TestVerifier contract has been deployed to: ${testVerifier.address}`)
            }

            return {
                testVerifier,
                pairingLib,
            }
        }
    )
