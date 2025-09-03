// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LotteryManager is Ownable, ReentrancyGuard {
    BlockEngageToken public immutable token;
    
    struct LotteryRound {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 totalTickets;
        address[] participants;
        address winner;
        string perkDescription;
        bool isCompleted;
    }
    
    struct Ticket {
        uint256 ticketNumber;
        address owner;
        uint256 roundId;
        string earnedFrom;
        bool isUsed;
    }
    
    mapping(uint256 => LotteryRound) public lotteryRounds;
    mapping(uint256 => Ticket) public tickets;
    mapping(address => uint256[]) public userTickets;
    mapping(uint256 => uint256[]) public roundTickets;
    
    uint256 public currentRoundId = 1;
    uint256 public nextTicketNumber = 1;
    uint256 public constant ROUND_DURATION = 7 days;
    
    event LotteryRoundStarted(uint256 indexed roundId, uint256 endTime);
    event TicketIssued(uint256 indexed ticketNumber, address indexed user, string reason);
    event LotteryDrawn(uint256 indexed roundId, address indexed winner, uint256 winningTicket);
    event PerkClaimed(uint256 indexed roundId, address indexed winner);
    
    constructor(address _tokenAddress) {
        token = BlockEngageToken(_tokenAddress);
        _startNewRound();
    }
    
    function issueTicket(address user, string memory reason) external onlyOwner {
        uint256 ticketNumber = nextTicketNumber++;
        
        tickets[ticketNumber] = Ticket({
            ticketNumber: ticketNumber,
            owner: user,
            roundId: currentRoundId,
            earnedFrom: reason,
            isUsed: false
        });
        
        userTickets[user].push(ticketNumber);
        roundTickets[currentRoundId].push(ticketNumber);
        lotteryRounds[currentRoundId].totalTickets++;
        
        // Add to participants if not already there
        address[] storage participants = lotteryRounds[currentRoundId].participants;
        bool isParticipant = false;
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == user) {
                isParticipant = true;
                break;
            }
        }
        if (!isParticipant) {
            participants.push(user);
        }
        
        emit TicketIssued(ticketNumber, user, reason);
    }
    
    function drawLottery() external onlyOwner nonReentrant {
        LotteryRound storage round = lotteryRounds[currentRoundId];
        require(block.timestamp >= round.endTime, "Round not ended");
        require(!round.isCompleted, "Round already completed");
        require(round.totalTickets > 0, "No tickets in round");
        
        // Generate pseudo-random number (in production, use Chainlink VRF)
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            round.totalTickets
        ))) % round.totalTickets;
        
        uint256 winningTicketNumber = roundTickets[currentRoundId][randomNumber];
        address winner = tickets[winningTicketNumber].owner;
        
        round.winner = winner;
        round.isCompleted = true;
        tickets[winningTicketNumber].isUsed = true;
        
        // Award bonus tokens to winner
        token.awardTokens(winner, 100, "Lottery winner bonus");
        
        emit LotteryDrawn(currentRoundId, winner, winningTicketNumber);
        
        // Start new round
        _startNewRound();
    }
    
    function _startNewRound() internal {
        currentRoundId++;
        
        lotteryRounds[currentRoundId] = LotteryRound({
            id: currentRoundId,
            startTime: block.timestamp,
            endTime: block.timestamp + ROUND_DURATION,
            totalTickets: 0,
            participants: new address[](0),
            winner: address(0),
            perkDescription: "Mystery Perk",
            isCompleted: false
        });
        
        emit LotteryRoundStarted(currentRoundId, block.timestamp + ROUND_DURATION);
    }
    
    function getUserTickets(address user) external view returns (uint256[] memory) {
        return userTickets[user];
    }
    
    function getCurrentRound() external view returns (LotteryRound memory) {
        return lotteryRounds[currentRoundId];
    }
    
    function getRoundTickets(uint256 roundId) external view returns (uint256[] memory) {
        return roundTickets[roundId];
    }
}
