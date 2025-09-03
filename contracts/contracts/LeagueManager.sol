// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LeagueManager is Ownable, ReentrancyGuard {
    BlockEngageToken public immutable token;
    
    struct League {
        uint256 id;
        string name;
        uint256 tier;
        uint256 seasonStart;
        uint256 seasonEnd;
        uint256 maxMembers;
        bool isActive;
        address creator;
    }
    
    struct UserLeague {
        uint256 leagueId;
        address user;
        uint256 totalPoints;
        uint256 rank;
        uint256 joinedAt;
    }
    
    struct WeeklyScore {
        uint256 week;
        uint256 year;
        uint256 points;
        uint256 tasksCompleted;
        uint256 tokensEarned;
    }
    
    mapping(uint256 => League) public leagues;
    mapping(uint256 => address[]) public leagueMembers;
    mapping(address => uint256[]) public userLeagues;
    mapping(uint256 => mapping(address => UserLeague)) public userLeagueData;
    mapping(address => mapping(uint256 => mapping(uint256 => WeeklyScore))) public weeklyScores; // user => week => year => score
    
    uint256 public nextLeagueId = 1;
    uint256 public constant WEEKLY_REWARD_POOL = 1000; // Tokens distributed to top performers
    
    event LeagueCreated(uint256 indexed leagueId, string name, address creator);
    event UserJoinedLeague(uint256 indexed leagueId, address indexed user);
    event WeeklyScoresUpdated(uint256 indexed leagueId, uint256 week, uint256 year);
    event SeasonEnded(uint256 indexed leagueId, address[] topPerformers);
    
    constructor(address _tokenAddress) {
        token = BlockEngageToken(_tokenAddress);
    }
    
    function createLeague(
        string memory name,
        uint256 tier,
        uint256 seasonDuration, // in seconds
        uint256 maxMembers
    ) external returns (uint256) {
        uint256 leagueId = nextLeagueId++;
        
        leagues[leagueId] = League({
            id: leagueId,
            name: name,
            tier: tier,
            seasonStart: block.timestamp,
            seasonEnd: block.timestamp + seasonDuration,
            maxMembers: maxMembers,
            isActive: true,
            creator: msg.sender
        });
        
        emit LeagueCreated(leagueId, name, msg.sender);
        return leagueId;
    }
    
    function joinLeague(uint256 leagueId) external {
        League storage league = leagues[leagueId];
        require(league.isActive, "League not active");
        require(block.timestamp < league.seasonEnd, "Season ended");
        require(leagueMembers[leagueId].length < league.maxMembers, "League full");
        require(userLeagueData[leagueId][msg.sender].user == address(0), "Already in league");
        
        leagueMembers[leagueId].push(msg.sender);
        userLeagues[msg.sender].push(leagueId);
        
        userLeagueData[leagueId][msg.sender] = UserLeague({
            leagueId: leagueId,
            user: msg.sender,
            totalPoints: 0,
            rank: 0,
            joinedAt: block.timestamp
        });
        
        emit UserJoinedLeague(leagueId, msg.sender);
    }
    
    function updateWeeklyScore(
        address user,
        uint256 week,
        uint256 year,
        uint256 points,
        uint256 tasksCompleted,
        uint256 tokensEarned
    ) external onlyOwner {
        weeklyScores[user][week][year] = WeeklyScore({
            week: week,
            year: year,
            points: points,
            tasksCompleted: tasksCompleted,
            tokensEarned: tokensEarned
        });
        
        // Update total points in all leagues user is part of
        uint256[] memory userLeagueIds = userLeagues[user];
        for (uint256 i = 0; i < userLeagueIds.length; i++) {
            userLeagueData[userLeagueIds[i]][user].totalPoints += points;
        }
    }
    
    function distributeWeeklyRewards(uint256 leagueId) external onlyOwner nonReentrant {
        League storage league = leagues[leagueId];
        require(league.isActive, "League not active");
        
        address[] memory members = leagueMembers[leagueId];
        require(members.length > 0, "No members in league");
        
        // Sort members by points (simplified - in practice, use off-chain sorting)
        // Distribute rewards to top 3
        if (members.length >= 1) {
            token.awardTokens(members[0], WEEKLY_REWARD_POOL * 50 / 100, "Weekly league winner");
        }
        if (members.length >= 2) {
            token.awardTokens(members[1], WEEKLY_REWARD_POOL * 30 / 100, "Weekly league runner-up");
        }
        if (members.length >= 3) {
            token.awardTokens(members[2], WEEKLY_REWARD_POOL * 20 / 100, "Weekly league third place");
        }
    }
    
    function getLeagueMembers(uint256 leagueId) external view returns (address[] memory) {
        return leagueMembers[leagueId];
    }
    
    function getUserLeagues(address user) external view returns (uint256[] memory) {
        return userLeagues[user];
    }
    
    function getLeague(uint256 leagueId) external view returns (League memory) {
        return leagues[leagueId];
    }
}
