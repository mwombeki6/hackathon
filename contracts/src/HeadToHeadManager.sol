// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "./TaskManager.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract HeadToHeadManager is Ownable, Pausable, ReentrancyGuard {
    BlockEngageToken public betToken;
    TaskManager public taskManager;
    
    enum ChallengeType { TaskCompletion, TokenEarning, Streak, Custom }
    enum ChallengeStatus { Created, Accepted, Active, Completed, Cancelled }
    
    struct Challenge {
        uint256 id;
        address challenger;
        address opponent;
        ChallengeType challengeType;
        ChallengeStatus status;
        uint256 wagerAmount;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        uint256 targetValue;
        string description;
        address winner;
        uint256 challengerScore;
        uint256 opponentScore;
        bool isPublic;
    }
    
    struct UserStats {
        uint256 challengesCreated;
        uint256 challengesAccepted;
        uint256 challengesWon;
        uint256 challengesLost;
        uint256 totalWagered;
        uint256 totalWon;
        uint256 winStreak;
        uint256 maxWinStreak;
    }
    
    mapping(uint256 => Challenge) public challenges;
    mapping(address => UserStats) public userStats;
    mapping(address => uint256[]) public userChallenges;
    mapping(address => uint256[]) public pendingChallenges;
    mapping(uint256 => mapping(address => uint256)) public challengeStartScores;
    
    uint256 public nextChallengeId = 1;
    uint256 public constant MIN_WAGER = 1 * 10**18; // 1 BET token
    uint256 public constant MAX_WAGER = 1000 * 10**18; // 1000 BET tokens
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 30 days;
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 5; // 5% platform fee
    
    event ChallengeCreated(uint256 indexed challengeId, address indexed challenger, address indexed opponent, uint256 wager);
    event ChallengeAccepted(uint256 indexed challengeId, address indexed opponent);
    event ChallengeStarted(uint256 indexed challengeId, uint256 startTime, uint256 endTime);
    event ChallengeCompleted(uint256 indexed challengeId, address indexed winner, uint256 winnerScore, uint256 loserScore);
    event ChallengeCancelled(uint256 indexed challengeId, address indexed canceller);
    event WinStreakUpdated(address indexed user, uint256 newStreak);
    
    constructor(address _betTokenAddress, address _taskManagerAddress) Ownable(msg.sender) {
        betToken = BlockEngageToken(_betTokenAddress);
        taskManager = TaskManager(_taskManagerAddress);
    }
    
    modifier challengeExists(uint256 challengeId) {
        require(challengeId > 0 && challengeId < nextChallengeId, "Challenge does not exist");
        _;
    }
    
    modifier onlyChallenger(uint256 challengeId) {
        require(challenges[challengeId].challenger == msg.sender, "Only challenger can perform this action");
        _;
    }
    
    modifier onlyOpponent(uint256 challengeId) {
        require(challenges[challengeId].opponent == msg.sender, "Only opponent can perform this action");
        _;
    }
    
    modifier onlyParticipant(uint256 challengeId) {
        Challenge memory challenge = challenges[challengeId];
        require(
            challenge.challenger == msg.sender || challenge.opponent == msg.sender,
            "Only challenge participants can perform this action"
        );
        _;
    }
    
    function createChallenge(
        address opponent,
        ChallengeType challengeType,
        uint256 wagerAmount,
        uint256 duration,
        uint256 targetValue,
        string memory description,
        bool isPublic
    ) external whenNotPaused returns (uint256) {
        require(opponent != address(0), "Invalid opponent address");
        require(opponent != msg.sender, "Cannot challenge yourself");
        require(wagerAmount >= MIN_WAGER && wagerAmount <= MAX_WAGER, "Invalid wager amount");
        require(duration >= MIN_DURATION && duration <= MAX_DURATION, "Invalid duration");
        require(betToken.balanceOf(msg.sender) >= wagerAmount, "Insufficient tokens for wager");
        
        uint256 challengeId = nextChallengeId++;
        
        challenges[challengeId] = Challenge({
            id: challengeId,
            challenger: msg.sender,
            opponent: opponent,
            challengeType: challengeType,
            status: ChallengeStatus.Created,
            wagerAmount: wagerAmount,
            duration: duration,
            startTime: 0,
            endTime: 0,
            targetValue: targetValue,
            description: description,
            winner: address(0),
            challengerScore: 0,
            opponentScore: 0,
            isPublic: isPublic
        });
        
        // Lock challenger's wager
        betToken.spendTokens(msg.sender, wagerAmount, "H2H challenge wager");
        
        userChallenges[msg.sender].push(challengeId);
        userChallenges[opponent].push(challengeId);
        pendingChallenges[opponent].push(challengeId);
        
        userStats[msg.sender].challengesCreated++;
        userStats[msg.sender].totalWagered += wagerAmount;
        
        emit ChallengeCreated(challengeId, msg.sender, opponent, wagerAmount);
        
        return challengeId;
    }
    
    function acceptChallenge(uint256 challengeId) 
        external challengeExists(challengeId) onlyOpponent(challengeId) whenNotPaused nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.status == ChallengeStatus.Created, "Challenge cannot be accepted");
        require(betToken.balanceOf(msg.sender) >= challenge.wagerAmount, "Insufficient tokens for wager");
        
        // Lock opponent's wager
        betToken.spendTokens(msg.sender, challenge.wagerAmount, "H2H challenge wager");
        
        challenge.status = ChallengeStatus.Accepted;
        challenge.startTime = block.timestamp;
        challenge.endTime = block.timestamp + challenge.duration;
        
        // Record starting scores for both participants
        _recordStartingScores(challengeId);
        
        challenge.status = ChallengeStatus.Active;
        
        userStats[msg.sender].challengesAccepted++;
        userStats[msg.sender].totalWagered += challenge.wagerAmount;
        
        // Remove from pending challenges
        _removePendingChallenge(msg.sender, challengeId);
        
        emit ChallengeAccepted(challengeId, msg.sender);
        emit ChallengeStarted(challengeId, challenge.startTime, challenge.endTime);
    }
    
    function completeChallenge(uint256 challengeId) 
        external challengeExists(challengeId) onlyParticipant(challengeId) whenNotPaused {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.status == ChallengeStatus.Active, "Challenge is not active");
        require(block.timestamp >= challenge.endTime, "Challenge has not ended yet");
        
        // Calculate final scores
        (uint256 challengerScore, uint256 opponentScore) = _calculateFinalScores(challengeId);
        
        challenge.challengerScore = challengerScore;
        challenge.opponentScore = opponentScore;
        challenge.status = ChallengeStatus.Completed;
        
        // Determine winner
        address winner;
        address loser;
        
        if (challengerScore > opponentScore) {
            winner = challenge.challenger;
            loser = challenge.opponent;
        } else if (opponentScore > challengerScore) {
            winner = challenge.opponent;
            loser = challenge.challenger;
        } else {
            // Tie - return wagers to both participants
            betToken.awardTokens(challenge.challenger, challenge.wagerAmount, "H2H challenge tie refund");
            betToken.awardTokens(challenge.opponent, challenge.wagerAmount, "H2H challenge tie refund");
            
            emit ChallengeCompleted(challengeId, address(0), challengerScore, opponentScore);
            return;
        }
        
        challenge.winner = winner;
        
        // Calculate platform fee and winnings
        uint256 totalPot = challenge.wagerAmount * 2;
        uint256 platformFee = (totalPot * PLATFORM_FEE_PERCENTAGE) / 100;
        uint256 winnings = totalPot - platformFee;
        
        // Award winnings to winner
        betToken.awardTokens(winner, winnings, "H2H challenge victory");
        
        // Update user stats
        _updateUserStats(winner, loser, winnings, challenge.wagerAmount);
        
        emit ChallengeCompleted(challengeId, winner, challengerScore, opponentScore);
    }
    
    function cancelChallenge(uint256 challengeId) 
        external challengeExists(challengeId) onlyParticipant(challengeId) whenNotPaused {
        Challenge storage challenge = challenges[challengeId];
        require(
            challenge.status == ChallengeStatus.Created || challenge.status == ChallengeStatus.Accepted,
            "Cannot cancel active or completed challenge"
        );
        
        challenge.status = ChallengeStatus.Cancelled;
        
        // Refund challenger's wager
        betToken.awardTokens(challenge.challenger, challenge.wagerAmount, "H2H challenge cancellation refund");
        
        // Refund opponent's wager if they had accepted
        if (challenge.status == ChallengeStatus.Accepted) {
            betToken.awardTokens(challenge.opponent, challenge.wagerAmount, "H2H challenge cancellation refund");
        }
        
        // Remove from pending challenges if applicable
        if (msg.sender == challenge.opponent) {
            _removePendingChallenge(msg.sender, challengeId);
        }
        
        emit ChallengeCancelled(challengeId, msg.sender);
    }
    
    function getChallenge(uint256 challengeId) external view challengeExists(challengeId) returns (Challenge memory) {
        return challenges[challengeId];
    }
    
    function getUserChallenges(address user) external view returns (uint256[] memory) {
        return userChallenges[user];
    }
    
    function getPendingChallenges(address user) external view returns (uint256[] memory) {
        return pendingChallenges[user];
    }
    
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }
    
    function getActiveChallenges(address user) external view returns (uint256[] memory) {
        uint256[] memory userChallengeIds = userChallenges[user];
        uint256[] memory activeChallenges = new uint256[](userChallengeIds.length);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < userChallengeIds.length; i++) {
            if (challenges[userChallengeIds[i]].status == ChallengeStatus.Active) {
                activeChallenges[activeCount] = userChallengeIds[i];
                activeCount++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeChallenges[i];
        }
        
        return result;
    }
    
    function _recordStartingScores(uint256 challengeId) internal {
        Challenge memory challenge = challenges[challengeId];
        
        if (challenge.challengeType == ChallengeType.TaskCompletion) {
            TaskManager.UserStats memory challengerStats = taskManager.getUserStats(challenge.challenger);
            TaskManager.UserStats memory opponentStats = taskManager.getUserStats(challenge.opponent);
            challengeStartScores[challengeId][challenge.challenger] = challengerStats.tasksCompleted;
            challengeStartScores[challengeId][challenge.opponent] = opponentStats.tasksCompleted;
        } else if (challenge.challengeType == ChallengeType.TokenEarning) {
            (,, uint256 challengerEarned) = betToken.getUserStats(challenge.challenger);
            (,, uint256 opponentEarned) = betToken.getUserStats(challenge.opponent);
            challengeStartScores[challengeId][challenge.challenger] = challengerEarned;
            challengeStartScores[challengeId][challenge.opponent] = opponentEarned;
        } else if (challenge.challengeType == ChallengeType.Streak) {
            TaskManager.UserStats memory challengerStats = taskManager.getUserStats(challenge.challenger);
            TaskManager.UserStats memory opponentStats = taskManager.getUserStats(challenge.opponent);
            challengeStartScores[challengeId][challenge.challenger] = challengerStats.currentStreak;
            challengeStartScores[challengeId][challenge.opponent] = opponentStats.currentStreak;
        }
    }
    
    function _calculateFinalScores(uint256 challengeId) internal view returns (uint256, uint256) {
        Challenge memory challenge = challenges[challengeId];
        uint256 challengerScore = 0;
        uint256 opponentScore = 0;
        
        if (challenge.challengeType == ChallengeType.TaskCompletion) {
            TaskManager.UserStats memory challengerStats = taskManager.getUserStats(challenge.challenger);
            TaskManager.UserStats memory opponentStats = taskManager.getUserStats(challenge.opponent);
            challengerScore = challengerStats.tasksCompleted - challengeStartScores[challengeId][challenge.challenger];
            opponentScore = opponentStats.tasksCompleted - challengeStartScores[challengeId][challenge.opponent];
        } else if (challenge.challengeType == ChallengeType.TokenEarning) {
            (,, uint256 challengerEarned) = betToken.getUserStats(challenge.challenger);
            (,, uint256 opponentEarned) = betToken.getUserStats(challenge.opponent);
            challengerScore = challengerEarned - challengeStartScores[challengeId][challenge.challenger];
            opponentScore = opponentEarned - challengeStartScores[challengeId][challenge.opponent];
        } else if (challenge.challengeType == ChallengeType.Streak) {
            TaskManager.UserStats memory challengerStats = taskManager.getUserStats(challenge.challenger);
            TaskManager.UserStats memory opponentStats = taskManager.getUserStats(challenge.opponent);
            challengerScore = challengerStats.currentStreak;
            opponentScore = opponentStats.currentStreak;
        }
        
        return (challengerScore, opponentScore);
    }
    
    function _updateUserStats(address winner, address loser, uint256 winnings, uint256 wagerAmount) internal {
        // Update winner stats
        UserStats storage winnerStats = userStats[winner];
        winnerStats.challengesWon++;
        winnerStats.totalWon += winnings;
        winnerStats.winStreak++;
        
        if (winnerStats.winStreak > winnerStats.maxWinStreak) {
            winnerStats.maxWinStreak = winnerStats.winStreak;
        }
        
        emit WinStreakUpdated(winner, winnerStats.winStreak);
        
        // Update loser stats
        UserStats storage loserStats = userStats[loser];
        loserStats.challengesLost++;
        loserStats.winStreak = 0; // Reset win streak
    }
    
    function _removePendingChallenge(address user, uint256 challengeId) internal {
        uint256[] storage pending = pendingChallenges[user];
        for (uint256 i = 0; i < pending.length; i++) {
            if (pending[i] == challengeId) {
                pending[i] = pending[pending.length - 1];
                pending.pop();
                break;
            }
        }
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
