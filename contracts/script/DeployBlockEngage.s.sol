// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BlockEngageToken} from "../src/BlockEngageToken.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {LeagueManager} from "../src/LeagueManager.sol";
import {LotteryManager} from "../src/LotteryManager.sol";
import {HeadToHeadManager} from "../src/HeadToHeadManager.sol";

contract DeployBlockEngage is Script {
    BlockEngageToken public betToken;
    TaskManager public taskManager;
    LeagueManager public leagueManager;
    LotteryManager public lotteryManager;
    HeadToHeadManager public h2hManager;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying BlockEngage contracts with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy BlockEngageToken first
        console.log("Deploying BlockEngageToken...");
        betToken = new BlockEngageToken();
        console.log("BlockEngageToken deployed at:", address(betToken));
        
        // Deploy TaskManager
        console.log("Deploying TaskManager...");
        taskManager = new TaskManager(address(betToken));
        console.log("TaskManager deployed at:", address(taskManager));
        
        // Deploy LeagueManager
        console.log("Deploying LeagueManager...");
        leagueManager = new LeagueManager(address(betToken), address(taskManager));
        console.log("LeagueManager deployed at:", address(leagueManager));
        
        // Deploy LotteryManager
        console.log("Deploying LotteryManager...");
        lotteryManager = new LotteryManager(address(betToken));
        console.log("LotteryManager deployed at:", address(lotteryManager));
        
        // Deploy HeadToHeadManager
        console.log("Deploying HeadToHeadManager...");
        h2hManager = new HeadToHeadManager(address(betToken), address(taskManager));
        console.log("HeadToHeadManager deployed at:", address(h2hManager));
        
        // Authorize contracts as minters
        console.log("Authorizing contracts as token minters...");
        betToken.authorizeMinter(address(taskManager));
        betToken.authorizeMinter(address(leagueManager));
        betToken.authorizeMinter(address(lotteryManager));
        betToken.authorizeMinter(address(h2hManager));
        
        // Authorize deployer as verifier in TaskManager
        taskManager.authorizeVerifier(deployer);
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("BlockEngageToken:", address(betToken));
        console.log("TaskManager:", address(taskManager));
        console.log("LeagueManager:", address(leagueManager));
        console.log("LotteryManager:", address(lotteryManager));
        console.log("HeadToHeadManager:", address(h2hManager));
        console.log("========================");
        
        // Save deployment addresses to file - commented out due to write restrictions
        // _saveDeploymentAddresses();
    }
    
    function _saveDeploymentAddresses() internal {
        string memory deploymentInfo = string(abi.encodePacked(
            "{\n",
            '  "network": "alphachain",\n',
            '  "timestamp": "', vm.toString(block.timestamp), '",\n',
            '  "deployer": "', vm.toString(msg.sender), '",\n',
            '  "contracts": {\n',
            '    "BlockEngageToken": "', vm.toString(address(betToken)), '",\n',
            '    "TaskManager": "', vm.toString(address(taskManager)), '",\n',
            '    "LeagueManager": "', vm.toString(address(leagueManager)), '",\n',
            '    "LotteryManager": "', vm.toString(address(lotteryManager)), '",\n',
            '    "HeadToHeadManager": "', vm.toString(address(h2hManager)), '"\n',
            '  }\n',
            '}'
        ));
        
        vm.writeFile("./deployments/alphachain.json", deploymentInfo);
        console.log("Deployment addresses saved to ./deployments/alphachain.json");
    }
}
