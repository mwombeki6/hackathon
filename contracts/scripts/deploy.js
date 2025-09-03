const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying BlockEngage contracts to AlphachainLive network...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

  // Deploy BlockEngageToken first
  console.log("\n1. Deploying BlockEngageToken...");
  const BlockEngageToken = await ethers.getContractFactory("BlockEngageToken");
  const token = await BlockEngageToken.deploy();
  await token.deployed();
  console.log("BlockEngageToken deployed to:", token.address);

  // Deploy TaskManager
  console.log("\n2. Deploying TaskManager...");
  const TaskManager = await ethers.getContractFactory("TaskManager");
  const taskManager = await TaskManager.deploy(token.address);
  await taskManager.deployed();
  console.log("TaskManager deployed to:", taskManager.address);

  // Deploy LeagueManager
  console.log("\n3. Deploying LeagueManager...");
  const LeagueManager = await ethers.getContractFactory("LeagueManager");
  const leagueManager = await LeagueManager.deploy(token.address);
  await leagueManager.deployed();
  console.log("LeagueManager deployed to:", leagueManager.address);

  // Deploy HeadToHeadManager
  console.log("\n4. Deploying HeadToHeadManager...");
  const HeadToHeadManager = await ethers.getContractFactory("HeadToHeadManager");
  const h2hManager = await HeadToHeadManager.deploy(token.address);
  await h2hManager.deployed();
  console.log("HeadToHeadManager deployed to:", h2hManager.address);

  // Deploy LotteryManager
  console.log("\n5. Deploying LotteryManager...");
  const LotteryManager = await ethers.getContractFactory("LotteryManager");
  const lotteryManager = await LotteryManager.deploy(token.address);
  await lotteryManager.deployed();
  console.log("LotteryManager deployed to:", lotteryManager.address);

  // Authorize contracts to mint tokens
  console.log("\n6. Authorizing contracts to mint tokens...");
  await token.authorizeMinter(taskManager.address);
  await token.authorizeMinter(leagueManager.address);
  await token.authorizeMinter(h2hManager.address);
  await token.authorizeMinter(lotteryManager.address);
  console.log("All contracts authorized as minters");

  // Save deployment info
  const deploymentInfo = {
    network: "alphachain",
    chainId: 1001,
    deployer: deployer.address,
    contracts: {
      BlockEngageToken: token.address,
      TaskManager: taskManager.address,
      LeagueManager: leagueManager.address,
      HeadToHeadManager: h2hManager.address,
      LotteryManager: lotteryManager.address
    },
    deployedAt: new Date().toISOString()
  };

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\nAdd these addresses to your .env file:");
  console.log(`REWARD_TOKEN_CONTRACT=${token.address}`);
  console.log(`TASK_MANAGER_CONTRACT=${taskManager.address}`);
  console.log(`LEAGUE_CONTRACT=${leagueManager.address}`);
  console.log(`H2H_CONTRACT=${h2hManager.address}`);
  console.log(`LOTTERY_CONTRACT=${lotteryManager.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
