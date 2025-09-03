// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BlockEngageToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract HeadToHeadManager is Ownable, ReentrancyGuard {
    BlockEngageToken public immutable token;
    
    struct H2HMatch {
        uint256 id;
        address challenger;
        address opponent;
        uint256 startTime;
        uint256 endTime;
        uint256 challengerScore;
        uint256 opponentScore;
        uint256 stakeAmount;
        MatchStatus status;
        address winner;
    }
    
    enum MatchStatus { Pending, Active, Completed, Cancelled }
    
    mapping(uint256 => H2HMatch) public matches;
    mapping(address => uint256[]) public userMatches;
    mapping(address => uint256) public userWins;
    mapping(address => uint256) public userLosses;
    
    uint256 public nextMatchId = 1;
    uint256 public constant MIN_STAKE = 5;
    uint256 public constant WINNER_BONUS = 20;
    
    event MatchCreated(uint256 indexed matchId, address indexed challenger, address indexed opponent);
    event MatchAccepted(uint256 indexed matchId);
    event MatchCompleted(uint256 indexed matchId, address indexed winner, uint256 prize);
    event MatchCancelled(uint256 indexed matchId);
    
    constructor(address _tokenAddress) {
        token = BlockEngageToken(_tokenAddress);
    }
    
    function createChallenge(
        address opponent,
        uint256 stakeAmount
    ) external returns (uint256) {
        require(opponent != address(0) && opponent != msg.sender, "Invalid opponent");
        require(stakeAmount >= MIN_STAKE, "Stake too low");
        require(token.balanceOf(msg.sender) >= stakeAmount, "Insufficient tokens");
        
        uint256 matchId = nextMatchId++;
        
        matches[matchId] = H2HMatch({
            id: matchId,
            challenger: msg.sender,
            opponent: opponent,
            startTime: 0, // Set when accepted
            endTime: 0,
            challengerScore: 0,
            opponentScore: 0,
            stakeAmount: stakeAmount,
            status: MatchStatus.Pending,
            winner: address(0)
        });
        
        userMatches[msg.sender].push(matchId);
        userMatches[opponent].push(matchId);
        
        // Lock challenger's stake
        token.spendTokens(msg.sender, stakeAmount, "H2H stake");
        
        emit MatchCreated(matchId, msg.sender, opponent);
        return matchId;
    }
    
    function acceptChallenge(uint256 matchId) external {
        H2HMatch storage h2hMatch = matches[matchId];
        require(h2hMatch.id != 0, "Match does not exist");
        require(msg.sender == h2hMatch.opponent, "Not the opponent");
        require(h2hMatch.status == MatchStatus.Pending, "Match not pending");
        require(token.balanceOf(msg.sender) >= h2hMatch.stakeAmount, "Insufficient tokens");
        
        // Lock opponent's stake
        token.spendTokens(msg.sender, h2hMatch.stakeAmount, "H2H stake");
        
        h2hMatch.status = MatchStatus.Active;
        h2hMatch.startTime = block.timestamp;
        h2hMatch.endTime = block.timestamp + 7 days; // Default 1 week
        
        emit MatchAccepted(matchId);
    }
    
    function settleMatch(
        uint256 matchId,
        uint256 challengerScore,
        uint256 opponentScore
    ) external onlyOwner {
        H2HMatch storage h2hMatch = matches[matchId];
        require(h2hMatch.status == MatchStatus.Active, "Match not active");
        require(block.timestamp >= h2hMatch.endTime, "Match not ended");
        
        h2hMatch.challengerScore = challengerScore;
        h2hMatch.opponentScore = opponentScore;
        h2hMatch.status = MatchStatus.Completed;
        
        uint256 totalPrize = h2hMatch.stakeAmount * 2 + WINNER_BONUS;
        
        if (challengerScore > opponentScore) {
            h2hMatch.winner = h2hMatch.challenger;
            userWins[h2hMatch.challenger]++;
            userLosses[h2hMatch.opponent]++;
            token.awardTokens(h2hMatch.challenger, totalPrize, "H2H victory");
        } else if (opponentScore > challengerScore) {
            h2hMatch.winner = h2hMatch.opponent;
            userWins[h2hMatch.opponent]++;
            userLosses[h2hMatch.challenger]++;
            token.awardTokens(h2hMatch.opponent, totalPrize, "H2H victory");
        } else {
            // Tie - return stakes
            token.awardTokens(h2hMatch.challenger, h2hMatch.stakeAmount, "H2H tie refund");
            token.awardTokens(h2hMatch.opponent, h2hMatch.stakeAmount, "H2H tie refund");
        }
        
        emit MatchCompleted(matchId, h2hMatch.winner, totalPrize);
    }
    
    function cancelMatch(uint256 matchId) external {
        H2HMatch storage h2hMatch = matches[matchId];
        require(h2hMatch.id != 0, "Match does not exist");
        require(
            msg.sender == h2hMatch.challenger || 
            msg.sender == h2hMatch.opponent || 
            msg.sender == owner(),
            "Not authorized"
        );
        require(h2hMatch.status == MatchStatus.Pending, "Can only cancel pending matches");
        
        // Refund challenger's stake
        token.awardTokens(h2hMatch.challenger, h2hMatch.stakeAmount, "H2H cancellation refund");
        
        h2hMatch.status = MatchStatus.Cancelled;
        emit MatchCancelled(matchId);
    }
    
    function getUserMatches(address user) external view returns (uint256[] memory) {
        return userMatches[user];
    }
    
    function getMatch(uint256 matchId) external view returns (H2HMatch memory) {
        return matches[matchId];
    }
    
    function getUserH2HStats(address user) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 activeMatches
    ) {
        uint256[] memory matchIds = userMatches[user];
        uint256 active = 0;
        
        for (uint256 i = 0; i < matchIds.length; i++) {
            if (matches[matchIds[i]].status == MatchStatus.Active) {
                active++;
            }
        }
        
        return (userWins[user], userLosses[user], active);
    }
}
