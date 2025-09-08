const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load contract ABIs from generated files
const loadABI = (contractName) => {
  try {
    const abiPath = path.join(__dirname, '../../contracts/', `${contractName}.abi.json`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to load ABI for ${contractName}:`, error);
    return [];
  }
};

const BlockEngageTokenABI = loadABI('BlockEngageToken');
const TaskManagerABI = loadABI('TaskManager');
const HeadToHeadManagerABI = loadABI('HeadToHeadManager');
const LeagueManagerABI = loadABI('LeagueManager');
const LotteryManagerABI = loadABI('LotteryManager');

// Priority enum mapping for TaskManager
const TaskPriority = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3
};

// Challenge type mapping for HeadToHeadManager
const ChallengeType = {
  TaskCompletion: 0,
  TokenEarning: 1,
  Streak: 2,
  Custom: 3
};

// League type mapping for LeagueManager
const LeagueType = {
  Public: 0,
  Private: 1,
  Department: 2
};

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
          lotteryManager: new this.web3.eth.Contract(LotteryManagerABI, process.env.LOTTERY_CONTRACT)
        };
        
        // Setup event listeners for blockchain sync
        this.setupEventListeners();
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

  async createTaskOnChain(title, description, assignee, priority, dueDate, tags = []) {
    if (!this.isConnected) {
      console.log('Mock: Create task on chain', { title, assignee, priority });
      return { txHash: 'mock-tx-hash', taskId: Math.floor(Math.random() * 1000000) };
    }
    try {
      // Convert priority string to enum value
      const priorityEnum = TaskPriority[priority] !== undefined ? TaskPriority[priority] : TaskPriority.Medium;
      const deadline = Math.floor(new Date(dueDate).getTime() / 1000);
      
      const tx = await this.contracts.taskManager.methods
        .createTask(title, description, assignee, priorityEnum, deadline, tags)
        .send({ from: this.account.address, gas: 500000 });
        
      // Parse events to get taskId
      const taskCreatedEvent = tx.events?.TaskCreated;
      const taskId = taskCreatedEvent?.returnValues?.taskId;
      
      return { 
        txHash: tx.transactionHash, 
        taskId: taskId ? parseInt(taskId) : null 
      };
    } catch (error) {
      console.error('Error creating task on chain:', error);
      throw error;
    }
  }

  async startTaskOnChain(taskId, assigneeAddress) {
    if (!this.isConnected) {
      console.log('Mock: Start task on chain', { taskId });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.taskManager.methods
        .startTask(taskId)
        .send({ from: assigneeAddress, gas: 250000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error starting task on chain:', error);
      throw error;
    }
  }

  async completeTaskOnChain(taskId, assigneeAddress) {
    if (!this.isConnected) {
      console.log('Mock: Complete task on chain', { taskId });
      return { txHash: 'mock-tx-hash', rewardAmount: '10000000000000000000' };
    }
    try {
      const tx = await this.contracts.taskManager.methods
        .completeTask(taskId)
        .send({ from: assigneeAddress, gas: 400000 });
        
      // Parse events to get reward amount
      const taskCompletedEvent = tx.events?.TaskCompleted;
      const rewardAmount = taskCompletedEvent?.returnValues?.rewardAmount;
      
      return {
        txHash: tx.transactionHash,
        rewardAmount: rewardAmount || '0'
      };
    } catch (error) {
      console.error('Error completing task on chain:', error);
      throw error;
    }
  }

  async verifyTaskOnChain(taskId, verifierAddress) {
    if (!this.isConnected) {
      console.log('Mock: Verify task on chain', { taskId });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.taskManager.methods
        .verifyTask(taskId)
        .send({ from: verifierAddress, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error verifying task on chain:', error);
      throw error;
    }
  }

  async cancelTaskOnChain(taskId, userAddress) {
    if (!this.isConnected) {
      console.log('Mock: Cancel task on chain', { taskId });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.taskManager.methods
        .cancelTask(taskId)
        .send({ from: userAddress, gas: 200000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error canceling task on chain:', error);
      throw error;
    }
  }

  async buyLotteryTickets(userAddress, quantity) {
    if (!this.isConnected) {
      console.log('Mock: Buy lottery tickets', { userAddress, quantity });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.lotteryManager.methods
        .buyTickets(quantity)
        .send({ from: userAddress, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error buying lottery tickets:', error);
      throw error;
    }
  }

  async drawLottery(adminAddress) {
    if (!this.isConnected) {
      console.log('Mock: Draw lottery');
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.lotteryManager.methods
        .drawLottery()
        .send({ from: adminAddress, gas: 400000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error drawing lottery:', error);
      throw error;
    }
  }

  async createLeague(creatorAddress, name, description, leagueType, maxParticipants, entryFee, duration) {
    if (!this.isConnected) {
      console.log('Mock: Create league', { name, leagueType });
      return { txHash: 'mock-tx-hash', leagueId: Math.floor(Math.random() * 1000000) };
    }
    try {
      const leagueTypeEnum = LeagueType[leagueType] !== undefined ? LeagueType[leagueType] : LeagueType.Public;
      
      const tx = await this.contracts.leagueManager.methods
        .createLeague(name, description, leagueTypeEnum, maxParticipants, entryFee, duration, [])
        .send({ from: creatorAddress, gas: 400000 });
        
      const leagueCreatedEvent = tx.events?.LeagueCreated;
      const leagueId = leagueCreatedEvent?.returnValues?.leagueId;
      
      return { 
        txHash: tx.transactionHash,
        leagueId: leagueId ? parseInt(leagueId) : null
      };
    } catch (error) {
      console.error('Error creating league:', error);
      throw error;
    }
  }

  async joinLeague(leagueId, participantAddress) {
    if (!this.isConnected) {
      console.log('Mock: Join league', { leagueId });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.leagueManager.methods
        .joinLeague(leagueId)
        .send({ from: participantAddress, gas: 250000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error joining league:', error);
      throw error;
    }
  }

  async createH2HChallenge(challengerAddress, opponent, challengeType, duration, wagerAmount, targetValue = 0, description = '') {
    if (!this.isConnected) {
      console.log('Mock: Create H2H challenge', { challengerAddress, opponent, challengeType });
      return { txHash: 'mock-tx-hash', challengeId: Math.floor(Math.random() * 1000000) };
    }
    try {
      const challengeTypeEnum = ChallengeType[challengeType] !== undefined ? ChallengeType[challengeType] : ChallengeType.TaskCompletion;
      
      const tx = await this.contracts.h2hManager.methods
        .createChallenge(opponent, challengeTypeEnum, duration, wagerAmount, targetValue, description, true)
        .send({ from: challengerAddress, gas: 400000 });
        
      const challengeCreatedEvent = tx.events?.ChallengeCreated;
      const challengeId = challengeCreatedEvent?.returnValues?.challengeId;
      
      return { 
        txHash: tx.transactionHash,
        challengeId: challengeId ? parseInt(challengeId) : null
      };
    } catch (error) {
      console.error('Error creating H2H challenge:', error);
      throw error;
    }
  }

  async acceptH2HChallenge(challengeId, opponentAddress) {
    if (!this.isConnected) {
      console.log('Mock: Accept H2H challenge', { challengeId });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.h2hManager.methods
        .acceptChallenge(challengeId)
        .send({ from: opponentAddress, gas: 300000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error accepting H2H challenge:', error);
      throw error;
    }
  }

  async finalizeH2HChallenge(challengeId, finalizeAddress) {
    if (!this.isConnected) {
      console.log('Mock: Finalize H2H challenge', { challengeId });
      return 'mock-tx-hash';
    }
    try {
      const tx = await this.contracts.h2hManager.methods
        .finalizeChallenge(challengeId)
        .send({ from: finalizeAddress, gas: 350000 });
      return tx.transactionHash;
    } catch (error) {
      console.error('Error finalizing H2H challenge:', error);
      throw error;
    }
  }

  // Event listener setup for blockchain synchronization
  setupEventListeners() {
    if (!this.isConnected || !this.contracts) return;
    
    try {
      // Task events
      this.contracts.taskManager.events.TaskCreated()
        .on('data', (event) => this.handleTaskCreated(event))
        .on('error', console.error);
        
      this.contracts.taskManager.events.TaskCompleted()
        .on('data', (event) => this.handleTaskCompleted(event))
        .on('error', console.error);
        
      this.contracts.taskManager.events.TaskVerified()
        .on('data', (event) => this.handleTaskVerified(event))
        .on('error', console.error);
        
      this.contracts.taskManager.events.StreakUpdated()
        .on('data', (event) => this.handleStreakUpdated(event))
        .on('error', console.error);
      
      // Token events
      this.contracts.token.events.TokensAwarded()
        .on('data', (event) => this.handleTokensAwarded(event))
        .on('error', console.error);
        
      // League events
      this.contracts.leagueManager.events.LeagueCreated()
        .on('data', (event) => this.handleLeagueCreated(event))
        .on('error', console.error);
        
      // H2H events
      this.contracts.h2hManager.events.ChallengeCreated()
        .on('data', (event) => this.handleChallengeCreated(event))
        .on('error', console.error);
        
      console.log('✅ Blockchain event listeners initialized');
    } catch (error) {
      console.error('Failed to setup event listeners:', error);
    }
  }

  // Event handlers
  async handleTaskCreated(event) {
    console.log('Task created on blockchain:', event.returnValues);
    // Emit to connected clients via Socket.io if available
    if (global.io) {
      global.io.emit('task-created', event.returnValues);
    }
  }

  async handleTaskCompleted(event) {
    console.log('Task completed on blockchain:', event.returnValues);
    if (global.io) {
      global.io.emit('task-completed', event.returnValues);
    }
  }

  async handleTaskVerified(event) {
    console.log('Task verified on blockchain:', event.returnValues);
    if (global.io) {
      global.io.emit('task-verified', event.returnValues);
    }
  }

  async handleStreakUpdated(event) {
    console.log('Streak updated on blockchain:', event.returnValues);
    if (global.io) {
      global.io.emit('streak-updated', event.returnValues);
    }
  }

  async handleTokensAwarded(event) {
    console.log('Tokens awarded on blockchain:', event.returnValues);
    if (global.io) {
      global.io.emit('tokens-awarded', event.returnValues);
    }
  }

  async handleLeagueCreated(event) {
    console.log('League created on blockchain:', event.returnValues);
    if (global.io) {
      global.io.emit('league-created', event.returnValues);
    }
  }

  async handleChallengeCreated(event) {
    console.log('Challenge created on blockchain:', event.returnValues);
    if (global.io) {
      global.io.emit('challenge-created', event.returnValues);
    }
  }

  // Utility methods
  async getBlockchainStats() {
    if (!this.isConnected) return null;
    
    try {
      const [blockNumber, gasPrice, balance] = await Promise.all([
        this.web3.eth.getBlockNumber(),
        this.web3.eth.getGasPrice(),
        this.web3.eth.getBalance(this.account.address)
      ]);
      
      return {
        blockNumber,
        gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei') + ' gwei',
        accountBalance: this.web3.utils.fromWei(balance, 'ether') + ' ETH',
        isConnected: true
      };
    } catch (error) {
      console.error('Error getting blockchain stats:', error);
      return null;
    }
  }
}

module.exports = new BlockchainService();
