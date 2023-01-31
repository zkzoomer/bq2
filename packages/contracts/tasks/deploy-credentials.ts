import { poseidon_gencontract as poseidonContract } from "circomlibjs"
import { task, types } from "hardhat/config"
import { saveDeployedContracts } from "../scripts/utils"

task("deploy:credentials", "Deploy the credentials contract")
    .addOptionalParam<boolean>("pairing", "Pairing library address", undefined, types.string)
    .addOptionalParam<boolean>("semaphoreVerifier", "SemaphoreVerifier contract address", undefined, types.string)
    .addOptionalParam<boolean>("poseidon", "Poseidon library address", undefined, types.string)
    .setAction(
        async (
            {
                logs,
                pairing: pairingAddress,
                updateGradeVerifier: updateGradeVerifierAddress,
                testVerifier: testVerifierAddress,
                poseidonT3: poseidonT3Address,
                poseidonT4: poseidonT4Address,
                credentials: credentialsAddress
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

            if (!updateGradeVerifierAddress) {
                const GradeUpdateVerifierFactory = await ethers.getContractFactory("UpdateGradeVerifier")
    
                const updateGradeVerifier = await GradeUpdateVerifierFactory.deploy()
    
                await updateGradeVerifier.deployed()

                updateGradeVerifierAddress = updateGradeVerifier.address
    
                if (logs) {
                    console.info(`UpdateGradeVerifier contract has been deployed to: ${updateGradeVerifier.address}`)
                }
            }

            if (!testVerifierAddress) {
                const TestVerifierFactory = await ethers.getContractFactory("TestVerifier")
    
                const testVerifier = await TestVerifierFactory.deploy()
    
                await testVerifier.deployed()

                testVerifierAddress = testVerifier.address
    
                if (logs) {
                    console.info(`TestVerifier contract has been deployed to: ${testVerifier.address}`)
                }
            }

            if (!poseidonT3Address) {
                const poseidonABI = poseidonContract.generateABI(2)
                const poseidonBytecode = poseidonContract.createCode(2)

                const [signer] = await ethers.getSigners()

                const PoseidonFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, signer)
                const poseidon = await PoseidonFactory.deploy()

                await poseidon.deployed()

                if (logs) {
                    console.info(`PoseidonT3 library has been deployed to: ${poseidon.address}`)
                }

                poseidonT3Address = poseidon.address
            }

            if (!poseidonT4Address) {
                const poseidonABI = poseidonContract.generateABI(3)
                const poseidonBytecode = poseidonContract.createCode(3)

                const [signer] = await ethers.getSigners()

                const PoseidonFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, signer)
                const poseidon = await PoseidonFactory.deploy()

                await poseidon.deployed()

                if (logs) {
                    console.info(`PoseidonT4 library has been deployed to: ${poseidon.address}`)
                }

                poseidonT4Address = poseidon.address
            }

            const CredentialsFactory = await ethers.getContractFactory("Credentials", {
                libraries: {
                    PoseidonT3: poseidonT3Address,
                    PoseidonT4: poseidonT4Address
                }
            })

            const credentials = await CredentialsFactory.deploy(testVerifierAddress, updateGradeVerifierAddress)

            await credentials.deployed()

            if (logs) {
                console.info(`Credentials contract has been deployed to: ${credentials.address}`)
            }

            return {
                credentials,
                pairingAddress,
                updateGradeVerifierAddress,
                testVerifierAddress,
                poseidonT3Address,
                poseidonT4Address
            }
        }
    )
