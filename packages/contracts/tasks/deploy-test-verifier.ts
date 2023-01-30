import { task, types } from "hardhat/config"

task("deploy:test-verifier", "Deploy the test verifier contract")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                pairing: pairingAddress
            },
            { ethers }
        ): Promise<any> => {    
            const TestVerifierFactory = await ethers.getContractFactory("TestVerifier")

            const testVerifier = await TestVerifierFactory.deploy()

            await testVerifier.deployed()

            if (logs) {
                console.info(`TestVerifier contract has been deployed to: ${testVerifier.address}`)
            }

            return {
                testVerifier,
                pairingAddress,
            }
        }
    )
