import { poseidon_gencontract as poseidonContract } from "circomlibjs"
import { task, types } from "hardhat/config"

task("deploy:credentials-registry", "Deploy the credentials contract")
    .addOptionalParam<boolean>("logs", "Print logs", false, types.boolean)
    .addOptionalParam<boolean>("connectTestManager", "Connect the TestCredentialManager by defining a new credential type", true, types.boolean)
    .addOptionalParam<boolean>("pairing", "Pairing library address", undefined, types.string)
    .addOptionalParam<boolean>("semaphoreVerifier", "SemaphoreVerifier contract address", undefined, types.string)
    .addOptionalParam<boolean>("gradeClaimVerifier", "GradeClaimVerifier contract address", undefined, types.string)
    .addOptionalParam<boolean>("testVerifier", "TestVerifier contract address", undefined, types.string)
    .addOptionalParam<boolean>("poseidonT3", "PoseidonT3 library address", undefined, types.string)
    .addOptionalParam<boolean>("poseidonT4", "PoseidonT3 library address", undefined, types.string)
    .addOptionalParam<boolean>("credentialsRegistry", "CredentialsRegistry contract address", undefined, types.string)
    .addOptionalParam<boolean>("testCredentialManager", "TestCredentialManager contract address", undefined, types.string)
    .setAction(
        async (
            {
                logs,
                connectTestManager,
                pairing: pairingAddress,
                semaphoreVerifier: semaphoreVerifierAddress,
                gradeClaimVerifier: gradeClaimVerifierAddress,
                testVerifier: testVerifierAddress,
                poseidonT3: poseidonT3Address,
                poseidonT4: poseidonT4Address,
                credentialsRegistry: credentialsRegistryAddress,
                testCredentialManager: testCredentialManagerAddress
            },
            { ethers }
        ): Promise<any> => {
            if (!semaphoreVerifierAddress) {
                if (!pairingAddress) {
                    const PairingFactory = await ethers.getContractFactory("@semaphore-protocol/contracts/base/Pairing.sol:Pairing")
                    const pairing = await PairingFactory.deploy()
    
                    await pairing.deployed()
    
                    pairingAddress = pairing.address
    
                    if (logs) {
                        console.info(`Pairing library has been deployed to: ${pairingAddress}`)
                    }
                }

                const SemaphoreVerifierFactory = await ethers.getContractFactory("SemaphoreVerifier", {
                    libraries: {
                        Pairing: pairingAddress
                    }
                })

                const semaphoreVerifier = await SemaphoreVerifierFactory.deploy()
    
                await semaphoreVerifier.deployed()

                semaphoreVerifierAddress = semaphoreVerifier.address
    
                if (logs) {
                    console.info(`SempaphoreVerifier contract has been deployed to: ${semaphoreVerifierAddress}`)
                }
            }

            if (!gradeClaimVerifierAddress) {
                const GradeClaimVerifierFactory = await ethers.getContractFactory("GradeClaimVerifier"/* , {
                    libraries: {
                        Pairing: pairingAddress
                    }
                } */)
                const gradeClaimVerifier = await GradeClaimVerifierFactory.deploy()

                await gradeClaimVerifier.deployed()

                gradeClaimVerifierAddress = gradeClaimVerifier.address
                
                if (logs) {
                    console.info(`GradeClaimVerifier contract has been deployed to: ${gradeClaimVerifierAddress}`)
                }
            }

            if (!testVerifierAddress) {
                const TestVerifierFactory = await ethers.getContractFactory("TestVerifier"/* , {
                    libraries: {
                        Pairing: pairingAddress
                    }
                } */)
                const testVerifier = await TestVerifierFactory.deploy()

                await testVerifier.deployed()

                testVerifierAddress = testVerifier.address
                
                if (logs) {
                    console.info(`TestVerifier contract has been deployed to: ${testVerifierAddress}`)
                }
            }

            if (!poseidonT3Address) {
                const poseidonABI = poseidonContract.generateABI(2)
                const poseidonBytecode = poseidonContract.createCode(2)

                const [signer] = await ethers.getSigners()

                const PoseidonFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, signer)
                const poseidon = await PoseidonFactory.deploy()

                await poseidon.deployed()

                poseidonT3Address = poseidon.address

                if (logs) {
                    console.info(`PoseidonT3 library has been deployed to: ${poseidonT3Address}`)
                }
            }

            if (!poseidonT4Address) {
                const poseidonABI = poseidonContract.generateABI(3)
                const poseidonBytecode = poseidonContract.createCode(3)

                const [signer] = await ethers.getSigners()

                const PoseidonFactory = new ethers.ContractFactory(poseidonABI, poseidonBytecode, signer)
                const poseidon = await PoseidonFactory.deploy()

                await poseidon.deployed()

                poseidonT4Address = poseidon.address

                if (logs) {
                    console.info(`PoseidonT4 library has been deployed to: ${poseidonT4Address}`)
                }
            }

            /// CREDENTIALS REGISTRY
            const CredentialsRegistryFactory = await ethers.getContractFactory("CredentialsRegistry", {
                libraries: {
                    PoseidonT3: poseidonT3Address
                }
            })

            const registry = await CredentialsRegistryFactory.deploy(semaphoreVerifierAddress, gradeClaimVerifierAddress)

            await registry.deployed()

            credentialsRegistryAddress = registry.address

            if (logs) {
                console.info(`CredentialsRegistry contract has been deployed to: ${credentialsRegistryAddress}`)
            }
            
            /// CREDENTIAL MANAGER EXAMPLE: TEST CREDENTIAL
            const TestCredentialManagerFactory = await ethers.getContractFactory("TestCredentialManager", {
                libraries: {
                    PoseidonT3: poseidonT3Address,
                    PoseidonT4: poseidonT4Address
                }
            })

            const testManager = await TestCredentialManagerFactory.deploy(credentialsRegistryAddress, testVerifierAddress)

            await testManager.deployed()

            testCredentialManagerAddress = testManager.address
            
            if (logs) {
                console.info(`TestCredentialManager contract has been deployed to: ${testCredentialManagerAddress}`)
            }

            /// CONNECTING THE CREDENTIAL MANAGER TO THE CREDENTIAL 
            if (connectTestManager) {
                await registry.defineCredentialType(0, testCredentialManagerAddress)
    
                if (logs) {
                    console.info(`TestCredentialManager succesfully set as credential type #0 for the credentials registry`)
                }
            }

            return {
                pairingAddress,
                semaphoreVerifierAddress,
                gradeClaimVerifierAddress,
                testVerifierAddress,
                poseidonT3Address,
                poseidonT4Address,
                registry,
                testManager
            }
        }
    )
