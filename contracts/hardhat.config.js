require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    alphachain: {
      url: process.env.ALPHACHAIN_RPC_URL || "https://rpc.alphachain.live",
      chainId: parseInt(process.env.ALPHACHAIN_CHAIN_ID) || 1001,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      alphachain: process.env.ALPHACHAIN_API_KEY || ""
    },
    customChains: [
      {
        network: "alphachain",
        chainId: 1001,
        urls: {
          apiURL: "https://api.alphachain.live/api",
          browserURL: "https://explorer.alphachain.live"
        }
      }
    ]
  }
};
