import "@nomicfoundation/hardhat-chai-matchers"
import "@nomicfoundation/hardhat-network-helpers"
import "@nomicfoundation/hardhat-toolbox"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "@typechain/hardhat"
import { config as dotenvConfig } from "dotenv"
import { readFileSync } from "fs"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import { HardhatUserConfig } from "hardhat/config"
import { NetworksUserConfig } from "hardhat/types"
import { resolve } from "path"
import "solidity-coverage"
import { config } from "./package.json"
import "./tasks/accounts"
import "./tasks/deploy-credentials-registry"
import "./tasks/deploy-grade-claim-verifier"
import "./tasks/deploy-test-verifier"

dotenvConfig({ path: resolve(__dirname, "../../.env") })
const mnemonic = readFileSync("../../.sneed").toString().trim();

const hardhatConfig: HardhatUserConfig = {
    solidity: config.solidity,
    paths: {
        sources: config.paths.sources,
        tests: config.paths.tests,
        cache: config.paths.cache,
        artifacts: config.paths.build.contracts
    },
    networks: {
        hardhat: {
            chainId: 1337,
            allowUnlimitedContractSize: true
        },
        mumbai: {
            url: 'https://rpc-mumbai.maticvigil.com',
            chainId: 80001,
            accounts: {
                mnemonic
            }
        }
    },
    gasReporter: {
        currency: "USD",
        enabled: true
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
    },
    mocha: {
        timeout: 50000
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: true,
    }
}

export default hardhatConfig
