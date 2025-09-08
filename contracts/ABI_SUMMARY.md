# Smart Contract ABI Files

This directory contains the extracted ABI (Application Binary Interface) files from the Foundry-compiled smart contracts. These ABI files can be used by backend services to interact with the deployed smart contracts.

## Available ABI Files

### 1. BlockEngageToken.abi.json
- **File Path**: `/home/mwombeki/Documents/hackathon/contracts/BlockEngageToken.abi.json`
- **Size**: 13,019 bytes
- **Description**: ERC20 token contract for the BlockEngage platform
- **Key Functions**: 
  - `awardTokens()` - Award tokens to users
  - `batchAwardTokens()` - Award tokens to multiple users
  - `getUserStats()` - Get user statistics
  - `authorizeMinter()` - Authorize token minting
  - Standard ERC20 functions (transfer, approve, etc.)

### 2. TaskManager.abi.json
- **File Path**: `/home/mwombeki/Documents/hackathon/contracts/TaskManager.abi.json`
- **Size**: 17,424 bytes
- **Description**: Manages task creation, completion, and verification
- **Key Functions**:
  - `createTask()` - Create new tasks
  - `completeTask()` - Mark tasks as completed
  - `verifyTask()` - Verify completed tasks
  - `cancelTask()` - Cancel tasks
  - `getUserTasks()` - Get user's tasks

### 3. HeadToHeadManager.abi.json
- **File Path**: `/home/mwombeki/Documents/hackathon/contracts/HeadToHeadManager.abi.json`
- **Size**: 18,569 bytes
- **Description**: Manages head-to-head challenges between users
- **Key Functions**:
  - `createChallenge()` - Create new challenges
  - `acceptChallenge()` - Accept challenges
  - `cancelChallenge()` - Cancel challenges
  - `finalizeChallenge()` - Finalize completed challenges

### 4. LeagueManager.abi.json
- **File Path**: `/home/mwombeki/Documents/hackathon/contracts/LeagueManager.abi.json`
- **Size**: 18,542 bytes
- **Description**: Manages league competitions and rankings
- **Key Functions**:
  - `createLeague()` - Create new leagues
  - `joinLeague()` - Join existing leagues
  - `getWeeklyRankings()` - Get weekly rankings
  - `finalizeWeek()` - Finalize weekly competitions

### 5. LotteryManager.abi.json
- **File Path**: `/home/mwombeki/Documents/hackathon/contracts/LotteryManager.abi.json`
- **Size**: 18,255 bytes
- **Description**: Manages lottery system and perks
- **Key Functions**:
  - `buyTickets()` - Purchase lottery tickets
  - `drawLottery()` - Draw lottery winners
  - `createPerk()` - Create new perks
  - `claimPerk()` - Claim earned perks

## Usage in Backend Integration

These ABI files contain the complete interface definitions for each smart contract, including:

- **Function Signatures**: All public and external functions with their parameters and return types
- **Event Definitions**: All events emitted by the contracts
- **Constructor Parameters**: Contract deployment parameters

### Example Usage (Web3.js/Ethers.js)

```javascript
const fs = require('fs');
const { ethers } = require('ethers');

// Load ABI
const taskManagerABI = JSON.parse(fs.readFileSync('./TaskManager.abi.json', 'utf8'));

// Create contract instance
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const contract = new ethers.Contract('CONTRACT_ADDRESS', taskManagerABI, provider);

// Call contract functions
const tasks = await contract.getUserTasks(userAddress);
```

## Compilation Details

- **Compiler**: Solidity 0.8.20
- **Build Tool**: Foundry Forge
- **Compilation Date**: September 6, 2025
- **Source Directory**: `/home/mwombeki/Documents/hackathon/contracts/src/`
- **Artifacts Directory**: `/home/mwombeki/Documents/hackathon/contracts/out/`

## Notes

- All ABI files are in JSON format and have been validated
- The ABIs include all inherited functions from OpenZeppelin contracts
- Event definitions include indexed parameters for efficient filtering
- Function inputs and outputs include proper type information for Web3 integration