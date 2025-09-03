// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VotingManager is Ownable, ReentrancyGuard {
    BlockEngageToken public immutable token;
    
    struct Poll {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 tokenCost;
        address[] nominees;
        mapping(address => uint256) votes;
        mapping(address => bool) hasVoted;
        address winner;
        bool isCompleted;
        uint256 totalVotes;
    }
    
    mapping(uint256 => Poll) public polls;
    mapping(address => uint256[]) public userVotes;
    
    uint256 public nextPollId = 1;
    uint256 public constant EMPLOYEE_OF_MONTH_REWARD = 500;
    uint256 public constant VOTE_COST = 5;
    
    event PollCreated(uint256 indexed pollId, string title, uint256 endTime);
    event VoteCast(uint256 indexed pollId, address indexed voter, address indexed nominee);
    event PollCompleted(uint256 indexed pollId, address indexed winner, uint256 totalVotes);
    
    constructor(address _tokenAddress) {
        token = BlockEngageToken(_tokenAddress);
        _transferOwnership(msg.sender);
    }
    
    function createPoll(
        string memory title,
        string memory description,
        uint256 duration,
        address[] memory nominees,
        uint256 tokenCost
    ) external onlyOwner returns (uint256) {
        require(nominees.length > 0, "Must have nominees");
        require(duration > 0, "Invalid duration");
        
        uint256 pollId = nextPollId++;
        Poll storage poll = polls[pollId];
        
        poll.id = pollId;
        poll.title = title;
        poll.description = description;
        poll.startTime = block.timestamp;
        poll.endTime = block.timestamp + duration;
        poll.tokenCost = tokenCost > 0 ? tokenCost : VOTE_COST;
        poll.nominees = nominees;
        poll.isCompleted = false;
        poll.totalVotes = 0;
        
        emit PollCreated(pollId, title, poll.endTime);
        return pollId;
    }
    
    function vote(uint256 pollId, address nominee) external nonReentrant {
        Poll storage poll = polls[pollId];
        require(poll.id != 0, "Poll does not exist");
        require(block.timestamp >= poll.startTime, "Poll not started");
        require(block.timestamp <= poll.endTime, "Poll ended");
        require(!poll.hasVoted[msg.sender], "Already voted");
        require(token.balanceOf(msg.sender) >= poll.tokenCost, "Insufficient tokens");
        
        // Verify nominee is valid
        bool isValidNominee = false;
        for (uint256 i = 0; i < poll.nominees.length; i++) {
            if (poll.nominees[i] == nominee) {
                isValidNominee = true;
                break;
            }
        }
        require(isValidNominee, "Invalid nominee");
        
        // Spend tokens for voting
        token.spendTokens(msg.sender, poll.tokenCost, "Poll voting");
        
        // Record vote
        poll.votes[nominee]++;
        poll.hasVoted[msg.sender] = true;
        poll.totalVotes++;
        userVotes[msg.sender].push(pollId);
        
        emit VoteCast(pollId, msg.sender, nominee);
    }
    
    function completePoll(uint256 pollId) external onlyOwner {
        Poll storage poll = polls[pollId];
        require(poll.id != 0, "Poll does not exist");
        require(block.timestamp > poll.endTime, "Poll still active");
        require(!poll.isCompleted, "Poll already completed");
        
        // Find winner (nominee with most votes)
        address winner = address(0);
        uint256 maxVotes = 0;
        
        for (uint256 i = 0; i < poll.nominees.length; i++) {
            address nominee = poll.nominees[i];
            if (poll.votes[nominee] > maxVotes) {
                maxVotes = poll.votes[nominee];
                winner = nominee;
            }
        }
        
        if (winner != address(0) && maxVotes > 0) {
            poll.winner = winner;
            // Award employee of the month tokens
            token.awardTokens(winner, EMPLOYEE_OF_MONTH_REWARD, "Employee of the Month");
        }
        
        poll.isCompleted = true;
        emit PollCompleted(pollId, winner, poll.totalVotes);
    }
    
    function getPollNominees(uint256 pollId) external view returns (address[] memory) {
        return polls[pollId].nominees;
    }
    
    function getPollVotes(uint256 pollId, address nominee) external view returns (uint256) {
        return polls[pollId].votes[nominee];
    }
    
    function hasUserVoted(uint256 pollId, address user) external view returns (bool) {
        return polls[pollId].hasVoted[user];
    }
    
    function getUserVotes(address user) external view returns (uint256[] memory) {
        return userVotes[user];
    }
}
