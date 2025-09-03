const { Web3 } = require('web3');
require('dotenv').config();

// Contract ABIs (simplified - in production, import from compiled artifacts)
const BlockEngageTokenABI = [
  {
    "inputs": [{"name": "user", "type": "address"}, {"name": "amount", "type": "uint256"}, {"name": "reason", "type": "string"}],
    "name": "awardTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "user", "type": "address"}, {"name": "amount", "type": "uint256"}, {"name": "purpose", "type": "string"}],
    "name": "spendTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "minter", "type": "address"}],
    "name": "authorizeMinter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const TaskManagerABI = [
  {
    "inputs": [{"name": "assignee", "type": "address"}, {"name": "title", "type": "string"}, {"name": "description", "type": "string"}, {"name": "deadline", "type": "uint256"}, {"name": "customReward", "type": "uint256"}],
    "name": "createTask",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "taskId", "type": "uint256"}],
    "name": "completeTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "taskId", "type": "uint256"}, {"name": "status", "type": "uint8"}],
    "name": "updateTaskStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "taskId", "type": "uint256"}],
    "name": "getTask",
    "outputs": [{"name": "", "type": "tuple"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const LeagueManagerABI = [
  "function createLeague(string memory name, uint256 tier, uint256 seasonDuration, uint256 maxMembers) external returns (uint256)",
  "function joinLeague(uint256 leagueId) external",
  "function updateWeeklyScore(address user, uint256 week, uint256 year, uint256 points, uint256 tasksCompleted, uint256 tokensEarned) external"
];

const HeadToHeadManagerABI = [
  "function createChallenge(address opponent, uint256 duration, uint256 stakeAmount) external returns (uint256)",
  "function acceptChallenge(uint256 matchId) external",
  "function settleMatch(uint256 matchId, uint256 challengerScore, uint256 opponentScore) external"
];

const LotteryManagerABI = [
  "function issueTicket(address user, string memory reason) external",
  "function drawLottery() external",
  "function getCurrentRound() external view returns (tuple)"
];

const VotingManagerABI = [
  {
    "inputs": [{"name": "title", "type": "string"}, {"name": "description", "type": "string"}, {"name": "duration", "type": "uint256"}, {"name": "nominees", "type": "address[]"}, {"name": "tokenCost", "type": "uint256"}],
    "name": "createPoll",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "pollId", "type": "uint256"}, {"name": "nominee", "type": "address"}],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "pollId", "type": "uint256"}],
    "name": "completePoll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

class BlockchainService {
  constructor() {
    try {
      this.web3 = new Web3(process.env.ALPHACHAIN_RPC_URL || 'http://localhost:8545');
      
      // Only initialize blockchain if private key is properly configured
      if (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 66) {
        this.account = this.web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(this.account);
        this.isConnected = true;
      } else {
        console.warn('Blockchain not configured - running in mock mode');
        this.isConnected = false;
      }
      
      // Initialize contracts only if connected
      if (this.isConnected) {
        this.contracts = {
          token: new this.web3.eth.Contract(BlockEngageTokenABI, process.env.REWARD_TOKEN_CONTRACT),
          taskManager: new this.web3.eth.Contract(TaskManagerABI, process.env.TASK_MANAGER_CONTRACT),
          leagueManager: new this.web3.eth.Contract(LeagueManagerABI, process.env.LEAGUE_CONTRACT),
          h2hManager: new this.web3.eth.Contract(HeadToHeadManagerABI, process.env.H2H_CONTRACT),
          lotteryManager: new this.web3.eth.Contract(LotteryManagerABI, process.env.LOTTERY_CONTRACT),
          votingManager: new this.web3.eth.Contract(VotingManagerABI, process.env.VOTING_CONTRACT)
        };
      }
    } catch (error) {
      console.error('Blockchain initialization failed:', error);
      this.isConnected = false;
    }
  }

  async awardTokens(userAddress, amount, reason) {
    if (!this.isConnected) {
      console.log('Mock: Award tokens', { userAddress, amount, reason });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.token.methods
        .awardTokens(userAddress, amount, reason)
        .send({ from: this.account.address, gas: 200000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error awarding tokens:', error);
      throw error;
    }
  }

  async spendTokens(userAddress, amount, purpose) {
    if (!this.isConnected) {
      console.log('Mock: Spend tokens', { userAddress, amount, purpose });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.token.methods
        .spendTokens(userAddress, amount, purpose)
        .send({ from: this.account.address, gas: 200000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error spending tokens:', error);
      throw error;
    }
  }

  async getUserTokenBalance(userAddress) {
    try {
      const balance = await this.contracts.token.methods.balanceOf(userAddress).call();
      return parseInt(balance);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  async createTaskOnChain(assignee, title, description, deadline, reward) {
    try {
      const tx = await this.contracts.taskManager.methods
        .createTask(assignee, title, description, deadline, reward)
        .send({ from: this.account.address, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error creating task on chain:', error);
      throw error;
    }
  }

  async completeTaskOnChain(taskId) {
    try {
      const tx = await this.contracts.taskManager.methods
        .completeTask(taskId)
        .send({ from: this.account.address, gas: 250000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error completing task on chain:', error);
      throw error;
    }
  }

  async issueTicket(userAddress, reason) {
    try {
      const tx = await this.contracts.lotteryManager.methods
        .issueTicket(userAddress, reason)
        .send({ from: this.account.address, gas: 200000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error issuing ticket:', error);
      throw error;
    }
  }

  async createLeague(name, tier, duration, maxMembers) {
    try {
      const tx = await this.contracts.leagueManager.methods
        .createLeague(name, tier, duration, maxMembers)
        .send({ from: this.account.address, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error creating league:', error);
      throw error;
    }
  }

  async createH2HChallenge(challenger, opponent, duration, stake) {
    try {
      const tx = await this.contracts.h2hManager.methods
        .createChallenge(opponent, duration, stake)
        .send({ from: challenger, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error creating H2H challenge:', error);
      throw error;
    }
  }

  async createPoll(title, description, duration, nominees, tokenCost) {
    try {
      const tx = await this.contracts.votingManager.methods
        .createPoll(title, description, duration, nominees, tokenCost)
        .send({ from: this.account.address, gas: 400000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  async vote(pollId, nominee) {
    if (!this.isConnected) {
      console.log('Mock: Vote', { pollId, nominee });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.votingManager.methods
        .vote(pollId, nominee)
        .send({ from: this.account.address, gas: 200000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error voting:', error);
      throw error;
    }
  }

  async completePoll(pollId) {
    try {
      const tx = await this.contracts.votingManager.methods
        .completePoll(pollId)
        .send({ from: this.account.address, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error completing poll:', error);
      throw error;
    }
  }
}

module.exports = new BlockchainService();
