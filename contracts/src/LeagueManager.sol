// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "./TaskManager.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract LeagueManager is Ownable, Pausable, ReentrancyGuard {
    BlockEngageToken public betToken;
    TaskManager public taskManager;
    
    enum LeagueType { Public, Private, Department }
    
    struct League {
        uint256 id;
        string name;
        string description;
        address creator;
        LeagueType leagueType;
        uint256 maxParticipants;
        uint256 entryFee;
        uint256 prizePool;
        uint256 currentWeek;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        string[] rules;
    }
    
    struct WeeklyScore {
        uint256 tasksCompleted;
        uint256 tokensEarned;
        uint256 streakBonus;
        uint256 verificationBonus;
        uint256 totalScore;
        uint256 rank;
    }
    
    struct Participant {
        address user;
        uint256 joinedWeek;
        uint256 totalScore;
        uint256 weeklyWins;
        bool isActive;
    }
    
    mapping(uint256 => League) public leagues;
    mapping(uint256 => mapping(address => Participant)) public leagueParticipants;
    mapping(uint256 => address[]) public leagueMembers;
    mapping(uint256 => mapping(uint256 => mapping(address => WeeklyScore))) public weeklyScores;
    mapping(uint256 => mapping(uint256 => address[])) public weeklyRankings;
    mapping(address => uint256[]) public userLeagues;
    
    uint256 public nextLeagueId = 1;
    uint256 public constant WEEK_DURATION = 7 days;
    uint256 public constant WINNER_REWARD_PERCENTAGE = 50; // 50% of prize pool
    uint256 public constant RUNNER_UP_PERCENTAGE = 30; // 30% of prize pool
    uint256 public constant THIRD_PLACE_PERCENTAGE = 20; // 20% of prize pool
    
    event LeagueCreated(uint256 indexed leagueId, address indexed creator, string name);
    event UserJoinedLeague(uint256 indexed leagueId, address indexed user);
    event UserLeftLeague(uint256 indexed leagueId, address indexed user);
    event WeeklyScoreUpdated(uint256 indexed leagueId, uint256 week, address indexed user, uint256 score);
    event WeeklyWinnerDeclared(uint256 indexed leagueId, uint256 week, address indexed winner, uint256 reward);
    event LeagueEnded(uint256 indexed leagueId, address indexed winner);
    
    constructor(address _betTokenAddress, address _taskManagerAddress) Ownable(msg.sender) {
        betToken = BlockEngageToken(_betTokenAddress);
        taskManager = TaskManager(_taskManagerAddress);
    }
    
    modifier leagueExists(uint256 leagueId) {
        require(leagueId > 0 && leagueId < nextLeagueId, "League does not exist");
        _;
    }
    
    modifier onlyLeagueParticipant(uint256 leagueId) {
        require(leagueParticipants[leagueId][msg.sender].isActive, "Not a league participant");
        _;
    }
    
    function createLeague(
        string memory name,
        string memory description,
        LeagueType leagueType,
        uint256 maxParticipants,
        uint256 entryFee,
        uint256 durationWeeks,
        string[] memory rules
    ) external whenNotPaused returns (uint256) {
        require(bytes(name).length > 0, "League name cannot be empty");
        require(maxParticipants >= 2, "League must allow at least 2 participants");
        require(durationWeeks > 0, "Duration must be at least 1 week");
        
        if (entryFee > 0) {
            require(betToken.balanceOf(msg.sender) >= entryFee, "Insufficient tokens for entry fee");
        }
        
        uint256 leagueId = nextLeagueId++;
        
        leagues[leagueId] = League({
            id: leagueId,
            name: name,
            description: description,
            creator: msg.sender,
            leagueType: leagueType,
            maxParticipants: maxParticipants,
            entryFee: entryFee,
            prizePool: 0,
            currentWeek: 1,
            startTime: block.timestamp,
            endTime: block.timestamp + (durationWeeks * WEEK_DURATION),
            isActive: true,
            rules: rules
        });
        
        // Creator automatically joins the league
        _joinLeague(leagueId, msg.sender);
        
        emit LeagueCreated(leagueId, msg.sender, name);
        
        return leagueId;
    }
    
    function joinLeague(uint256 leagueId) external leagueExists(leagueId) whenNotPaused {
        League storage league = leagues[leagueId];
        require(league.isActive, "League is not active");
        require(block.timestamp < league.endTime, "League has ended");
        require(!leagueParticipants[leagueId][msg.sender].isActive, "Already in league");
        require(leagueMembers[leagueId].length < league.maxParticipants, "League is full");
        
        if (league.entryFee > 0) {
            require(betToken.balanceOf(msg.sender) >= league.entryFee, "Insufficient tokens for entry fee");
            betToken.spendTokens(msg.sender, league.entryFee, "League entry fee");
            league.prizePool += league.entryFee;
        }
        
        _joinLeague(leagueId, msg.sender);
    }
    
    function leaveLeague(uint256 leagueId) external leagueExists(leagueId) onlyLeagueParticipant(leagueId) {
        require(msg.sender != leagues[leagueId].creator, "Creator cannot leave league");
        
        leagueParticipants[leagueId][msg.sender].isActive = false;
        
        // Remove from members array
        address[] storage members = leagueMembers[leagueId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == msg.sender) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        
        emit UserLeftLeague(leagueId, msg.sender);
    }
    
    function updateWeeklyScores(uint256 leagueId) external leagueExists(leagueId) whenNotPaused {
        League storage league = leagues[leagueId];
        require(league.isActive, "League is not active");
        
        uint256 currentWeek = _getCurrentWeek(leagueId);
        require(currentWeek <= _getTotalWeeks(leagueId), "League has ended");
        
        address[] memory members = leagueMembers[leagueId];
        
        for (uint256 i = 0; i < members.length; i++) {
            address user = members[i];
            if (!leagueParticipants[leagueId][user].isActive) continue;
            
            _calculateWeeklyScore(leagueId, currentWeek, user);
        }
        
        _rankParticipants(leagueId, currentWeek);
        _distributeWeeklyRewards(leagueId, currentWeek);
        
        // Check if league should end
        if (currentWeek >= _getTotalWeeks(leagueId)) {
            _endLeague(leagueId);
        }
    }
    
    function getLeague(uint256 leagueId) external view leagueExists(leagueId) returns (League memory) {
        return leagues[leagueId];
    }
    
    function getLeagueMembers(uint256 leagueId) external view leagueExists(leagueId) returns (address[] memory) {
        return leagueMembers[leagueId];
    }
    
    function getUserLeagues(address user) external view returns (uint256[] memory) {
        return userLeagues[user];
    }
    
    function getWeeklyScore(uint256 leagueId, uint256 week, address user) 
        external view leagueExists(leagueId) returns (WeeklyScore memory) {
        return weeklyScores[leagueId][week][user];
    }
    
    function getWeeklyRankings(uint256 leagueId, uint256 week) 
        external view leagueExists(leagueId) returns (address[] memory) {
        return weeklyRankings[leagueId][week];
    }
    
    function _joinLeague(uint256 leagueId, address user) internal {
        uint256 currentWeek = _getCurrentWeek(leagueId);
        
        leagueParticipants[leagueId][user] = Participant({
            user: user,
            joinedWeek: currentWeek,
            totalScore: 0,
            weeklyWins: 0,
            isActive: true
        });
        
        leagueMembers[leagueId].push(user);
        userLeagues[user].push(leagueId);
        
        emit UserJoinedLeague(leagueId, user);
    }
    
    function _calculateWeeklyScore(uint256 leagueId, uint256 week, address user) internal {
        // Get user stats from TaskManager
        (uint256 balance, uint256 totalEarned, uint256 totalSpent) = betToken.getUserStats(user);
        TaskManager.UserStats memory userTaskStats = taskManager.getUserStats(user);
        uint256 tasksCompleted = userTaskStats.tasksCompleted;
        uint256 tasksVerified = userTaskStats.tasksVerified;
        uint256 totalRewardsEarned = userTaskStats.totalRewardsEarned;
        uint256 currentStreak = userTaskStats.currentStreak;
        
        // Calculate score based on various metrics
        uint256 taskScore = tasksCompleted * 10;
        uint256 tokenScore = totalEarned / 10**18; // Convert from wei
        uint256 streakScore = currentStreak * 5;
        uint256 verificationScore = tasksVerified * 15;
        
        uint256 totalScore = taskScore + tokenScore + streakScore + verificationScore;
        
        weeklyScores[leagueId][week][user] = WeeklyScore({
            tasksCompleted: tasksCompleted,
            tokensEarned: totalEarned,
            streakBonus: streakScore,
            verificationBonus: verificationScore,
            totalScore: totalScore,
            rank: 0 // Will be set during ranking
        });
        
        // Update participant total score
        leagueParticipants[leagueId][user].totalScore += totalScore;
        
        emit WeeklyScoreUpdated(leagueId, week, user, totalScore);
    }
    
    function _rankParticipants(uint256 leagueId, uint256 week) internal {
        address[] memory members = leagueMembers[leagueId];
        
        // Simple bubble sort for ranking (can be optimized for larger leagues)
        for (uint256 i = 0; i < members.length - 1; i++) {
            for (uint256 j = 0; j < members.length - i - 1; j++) {
                if (weeklyScores[leagueId][week][members[j]].totalScore < 
                    weeklyScores[leagueId][week][members[j + 1]].totalScore) {
                    address temp = members[j];
                    members[j] = members[j + 1];
                    members[j + 1] = temp;
                }
            }
        }
        
        // Set ranks and store rankings
        weeklyRankings[leagueId][week] = members;
        for (uint256 i = 0; i < members.length; i++) {
            weeklyScores[leagueId][week][members[i]].rank = i + 1;
        }
    }
    
    function _distributeWeeklyRewards(uint256 leagueId, uint256 week) internal {
        League storage league = leagues[leagueId];
        address[] memory rankings = weeklyRankings[leagueId][week];
        
        if (rankings.length == 0 || league.prizePool == 0) return;
        
        uint256 weeklyPrize = league.prizePool / _getTotalWeeks(leagueId);
        
        // Winner gets 50% of weekly prize
        if (rankings.length >= 1) {
            uint256 winnerReward = (weeklyPrize * WINNER_REWARD_PERCENTAGE) / 100;
            betToken.awardTokens(rankings[0], winnerReward, "Weekly league winner");
            leagueParticipants[leagueId][rankings[0]].weeklyWins++;
            emit WeeklyWinnerDeclared(leagueId, week, rankings[0], winnerReward);
        }
        
        // Runner-up gets 30%
        if (rankings.length >= 2) {
            uint256 runnerUpReward = (weeklyPrize * RUNNER_UP_PERCENTAGE) / 100;
            betToken.awardTokens(rankings[1], runnerUpReward, "Weekly league runner-up");
        }
        
        // Third place gets 20%
        if (rankings.length >= 3) {
            uint256 thirdPlaceReward = (weeklyPrize * THIRD_PLACE_PERCENTAGE) / 100;
            betToken.awardTokens(rankings[2], thirdPlaceReward, "Weekly league third place");
        }
    }
    
    function _endLeague(uint256 leagueId) internal {
        League storage league = leagues[leagueId];
        league.isActive = false;
        
        // Find overall winner based on total score
        address[] memory members = leagueMembers[leagueId];
        address winner = members[0];
        uint256 highestScore = leagueParticipants[leagueId][winner].totalScore;
        
        for (uint256 i = 1; i < members.length; i++) {
            if (leagueParticipants[leagueId][members[i]].totalScore > highestScore) {
                winner = members[i];
                highestScore = leagueParticipants[leagueId][members[i]].totalScore;
            }
        }
        
        emit LeagueEnded(leagueId, winner);
    }
    
    function _getCurrentWeek(uint256 leagueId) internal view returns (uint256) {
        League memory league = leagues[leagueId];
        if (block.timestamp < league.startTime) return 1;
        return ((block.timestamp - league.startTime) / WEEK_DURATION) + 1;
    }
    
    function _getTotalWeeks(uint256 leagueId) internal view returns (uint256) {
        League memory league = leagues[leagueId];
        return (league.endTime - league.startTime) / WEEK_DURATION;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
