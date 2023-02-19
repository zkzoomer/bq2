import { poseidon_gencontract as poseidonContract } from "circomlibjs"
import { task, types } from "hardhat/config"

task("deploy:credentials", "Deploy the credentials contract")
    .addOptionalParam<boolean>("pairingLib", "PairingLib library address", undefined, types.string)
    .addOptionalParam<boolean>("semaphoreVerifier", "SemaphoreVerifier contract address", undefined, types.string)
    .addOptionalParam<boolean>("poseidon", "Poseidon library address", undefined, types.string)
    .setAction(
        async (
            {
                logs,
                semaphoreVerifier: semaphoreVerifierAddress,
                pairingLib: pairingLibAddress,
                poseidonT3: poseidonT3Address,
                poseidonT4: poseidonT4Address,
                credentials: credentialsAddress
            },
            { ethers }
        ): Promise<any> => {
            if (!semaphoreVerifierAddress) {
                const PairingFactory = await ethers.getContractFactory("@semaphore-protocol/contracts/base/Pairing.sol:Pairing")
                const pairing = await PairingFactory.deploy()

                await pairing.deployed()

                const SemaphoreVerifierFactory = await ethers.getContractFactory("@semaphore-protocol/contracts/base/SemaphoreVerifier.sol:SemaphoreVerifier", {
                    libraries: {
                        Pairing: pairing.address
                    }
                })
                const semaphoreVerifier = await SemaphoreVerifierFactory.deploy()
    
                await semaphoreVerifier.deployed()

                semaphoreVerifierAddress = semaphoreVerifier.address
    
                if (logs) {
                    console.info(`SempaphoreVerifier contract has been deployed to: ${semaphoreVerifier.address}`)
                }
            }

            if (!pairingLibAddress) {
                const PairingLibFactory = await ethers.getContractFactory("PairingLib")
                const pairingLib = await PairingLibFactory.deploy()

                await pairingLib.deployed()

                if (logs) {
                    console.info(`PairingLib library has been deployed to: ${pairingLib.address}`)
                }

                pairingLibAddress = pairingLib.address
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
                    /* PairingLib: pairingLibAddress, */
                    PoseidonT3: poseidonT3Address,
                    PoseidonT4: poseidonT4Address
                }
            })

            const credentials = await CredentialsFactory.deploy(semaphoreVerifierAddress)

            await credentials.deployed()

            credentialsAddress = credentials.address
            if (logs) {
                console.info(`Credentials contract has been deployed to: ${credentialsAddress}`)
            }

            return {
                credentials,
                semaphoreVerifierAddress,
                pairingLibAddress,
                poseidonT3Address,
                poseidonT4Address,
                credentialsAddress
            }
        }
    )
