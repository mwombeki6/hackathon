// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract LotteryManager is Ownable, Pausable, ReentrancyGuard {
    BlockEngageToken public betToken;
    
    enum PerkType { TokenReward, ExtraBreak, ParkingSpot, CoffeeVoucher, FlexTime, HomeOffice, Custom }
    
    struct Perk {
        uint256 id;
        string name;
        string description;
        PerkType perkType;
        uint256 tokenValue;
        uint256 quantity;
        uint256 validityDays;
        bool isActive;
        string metadata; // JSON string for additional data
    }
    
    struct LotteryRound {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 ticketPrice;
        uint256 totalTickets;
        uint256 prizePool;
        uint256[] availablePerks;
        address[] participants;
        address[] winners;
        uint256[] winningPerks;
        bool isComplete;
        bool isDrawn;
    }
    
    struct UserTicket {
        uint256 roundId;
        uint256 ticketNumber;
        uint256 purchaseTime;
        bool isWinner;
    }
    
    mapping(uint256 => Perk) public perks;
    mapping(uint256 => LotteryRound) public lotteryRounds;
    mapping(address => UserTicket[]) public userTickets;
    mapping(uint256 => mapping(address => uint256)) public userTicketCount;
    mapping(address => uint256[]) public userWonPerks;
    
    uint256 public nextPerkId = 1;
    uint256 public nextRoundId = 1;
    uint256 public currentRoundId = 0;
    uint256 public constant ROUND_DURATION = 7 days;
    uint256 public constant MIN_TICKET_PRICE = 5 * 10**18; // 5 BET tokens
    uint256 public constant MAX_TICKETS_PER_USER = 10;
    
    event PerkCreated(uint256 indexed perkId, string name, PerkType perkType);
    event LotteryRoundStarted(uint256 indexed roundId, uint256 ticketPrice, uint256 endTime);
    event TicketPurchased(uint256 indexed roundId, address indexed user, uint256 ticketNumber);
    event LotteryDrawn(uint256 indexed roundId, address[] winners, uint256[] perks);
    event PerkClaimed(uint256 indexed perkId, address indexed winner);
    event PerkExpired(uint256 indexed perkId, address indexed user);
    
    constructor(address _betTokenAddress) Ownable(msg.sender) {
        betToken = BlockEngageToken(_betTokenAddress);
        _createDefaultPerks();
    }
    
    modifier roundExists(uint256 roundId) {
        require(roundId > 0 && roundId < nextRoundId, "Lottery round does not exist");
        _;
    }
    
    modifier perkExists(uint256 perkId) {
        require(perkId > 0 && perkId < nextPerkId, "Perk does not exist");
        _;
    }
    
    function createPerk(
        string memory name,
        string memory description,
        PerkType perkType,
        uint256 tokenValue,
        uint256 quantity,
        uint256 validityDays,
        string memory metadata
    ) external onlyOwner returns (uint256) {
        require(bytes(name).length > 0, "Perk name cannot be empty");
        require(quantity > 0, "Quantity must be greater than 0");
        
        uint256 perkId = nextPerkId++;
        
        perks[perkId] = Perk({
            id: perkId,
            name: name,
            description: description,
            perkType: perkType,
            tokenValue: tokenValue,
            quantity: quantity,
            validityDays: validityDays,
            isActive: true,
            metadata: metadata
        });
        
        emit PerkCreated(perkId, name, perkType);
        
        return perkId;
    }
    
    function startLotteryRound(
        uint256 ticketPrice,
        uint256[] memory availablePerks
    ) external onlyOwner whenNotPaused returns (uint256) {
        require(ticketPrice >= MIN_TICKET_PRICE, "Ticket price too low");
        require(availablePerks.length > 0, "Must have at least one perk");
        
        // End current round if active
        if (currentRoundId > 0 && !lotteryRounds[currentRoundId].isComplete) {
            _endLotteryRound(currentRoundId);
        }
        
        uint256 roundId = nextRoundId++;
        currentRoundId = roundId;
        
        // Validate all perks exist and are active
        for (uint256 i = 0; i < availablePerks.length; i++) {
            require(perks[availablePerks[i]].isActive, "Inactive perk included");
        }
        
        lotteryRounds[roundId] = LotteryRound({
            id: roundId,
            startTime: block.timestamp,
            endTime: block.timestamp + ROUND_DURATION,
            ticketPrice: ticketPrice,
            totalTickets: 0,
            prizePool: 0,
            availablePerks: availablePerks,
            participants: new address[](0),
            winners: new address[](0),
            winningPerks: new uint256[](0),
            isComplete: false,
            isDrawn: false
        });
        
        emit LotteryRoundStarted(roundId, ticketPrice, block.timestamp + ROUND_DURATION);
        
        return roundId;
    }
    
    function buyTickets(uint256 roundId, uint256 numTickets) 
        external roundExists(roundId) whenNotPaused nonReentrant {
        LotteryRound storage round = lotteryRounds[roundId];
        require(block.timestamp < round.endTime, "Lottery round has ended");
        require(!round.isComplete, "Lottery round is complete");
        require(numTickets > 0, "Must buy at least one ticket");
        require(
            userTicketCount[roundId][msg.sender] + numTickets <= MAX_TICKETS_PER_USER,
            "Exceeds maximum tickets per user"
        );
        
        uint256 totalCost = round.ticketPrice * numTickets;
        require(betToken.balanceOf(msg.sender) >= totalCost, "Insufficient tokens");
        
        // Transfer tokens to contract
        betToken.spendTokens(msg.sender, totalCost, "Lottery ticket purchase");
        round.prizePool += totalCost;
        
        // Add user to participants if first ticket
        if (userTicketCount[roundId][msg.sender] == 0) {
            round.participants.push(msg.sender);
        }
        
        // Create tickets
        for (uint256 i = 0; i < numTickets; i++) {
            uint256 ticketNumber = round.totalTickets + i + 1;
            
            userTickets[msg.sender].push(UserTicket({
                roundId: roundId,
                ticketNumber: ticketNumber,
                purchaseTime: block.timestamp,
                isWinner: false
            }));
            
            emit TicketPurchased(roundId, msg.sender, ticketNumber);
        }
        
        round.totalTickets += numTickets;
        userTicketCount[roundId][msg.sender] += numTickets;
    }
    
    function drawLottery(uint256 roundId) external onlyOwner roundExists(roundId) {
        LotteryRound storage round = lotteryRounds[roundId];
        require(block.timestamp >= round.endTime, "Lottery round not yet ended");
        require(!round.isDrawn, "Lottery already drawn");
        require(round.totalTickets > 0, "No tickets sold");
        
        round.isDrawn = true;
        
        // Determine number of winners based on available perks
        uint256 numWinners = 0;
        for (uint256 i = 0; i < round.availablePerks.length; i++) {
            numWinners += perks[round.availablePerks[i]].quantity;
        }
        
        // Limit winners to number of participants
        if (numWinners > round.participants.length) {
            numWinners = round.participants.length;
        }
        
        // Simple pseudo-random selection (in production, use Chainlink VRF)
        uint256[] memory winningTickets = new uint256[](numWinners);
        address[] memory winners = new address[](numWinners);
        uint256[] memory winningPerks = new uint256[](numWinners);
        
        uint256 perkIndex = 0;
        uint256 perkQuantityUsed = 0;
        
        for (uint256 i = 0; i < numWinners; i++) {
            // Generate pseudo-random ticket number
            uint256 randomTicket = (uint256(keccak256(abi.encodePacked(
                block.timestamp, block.prevrandao, i, msg.sender
            ))) % round.totalTickets) + 1;
            
            winningTickets[i] = randomTicket;
            
            // Find ticket owner
            address winner = _findTicketOwner(roundId, randomTicket);
            winners[i] = winner;
            
            // Assign perk
            while (perkIndex < round.availablePerks.length && 
                   perkQuantityUsed >= perks[round.availablePerks[perkIndex]].quantity) {
                perkIndex++;
                perkQuantityUsed = 0;
            }
            
            if (perkIndex < round.availablePerks.length) {
                winningPerks[i] = round.availablePerks[perkIndex];
                perkQuantityUsed++;
                
                // Mark user tickets as winners and add to user's won perks
                _markUserTicketsAsWinners(roundId, winner);
                userWonPerks[winner].push(winningPerks[i]);
            }
        }
        
        round.winners = winners;
        round.winningPerks = winningPerks;
        
        emit LotteryDrawn(roundId, winners, winningPerks);
        
        _endLotteryRound(roundId);
    }
    
    function claimPerk(uint256 perkId) external perkExists(perkId) {
        require(_userHasPerk(msg.sender, perkId), "User does not have this perk");
        
        Perk storage perk = perks[perkId];
        
        // If it's a token reward, transfer tokens
        if (perk.perkType == PerkType.TokenReward) {
            betToken.awardTokens(msg.sender, perk.tokenValue, "Lottery perk claim");
        }
        
        // Remove perk from user's won perks (mark as claimed)
        _removePerkFromUser(msg.sender, perkId);
        
        emit PerkClaimed(perkId, msg.sender);
    }
    
    function getCurrentRound() external view returns (LotteryRound memory) {
        if (currentRoundId == 0) {
            // Return empty round
            return LotteryRound({
                id: 0,
                startTime: 0,
                endTime: 0,
                ticketPrice: 0,
                totalTickets: 0,
                prizePool: 0,
                availablePerks: new uint256[](0),
                participants: new address[](0),
                winners: new address[](0),
                winningPerks: new uint256[](0),
                isComplete: false,
                isDrawn: false
            });
        }
        return lotteryRounds[currentRoundId];
    }
    
    function getUserTickets(address user) external view returns (UserTicket[] memory) {
        return userTickets[user];
    }
    
    function getUserWonPerks(address user) external view returns (uint256[] memory) {
        return userWonPerks[user];
    }
    
    function getPerk(uint256 perkId) external view perkExists(perkId) returns (Perk memory) {
        return perks[perkId];
    }
    
    function getRoundParticipants(uint256 roundId) external view roundExists(roundId) returns (address[] memory) {
        return lotteryRounds[roundId].participants;
    }
    
    function _createDefaultPerks() internal {
        // Create some default perks
        _createPerkInternal("Bonus Tokens", "50 BET tokens", PerkType.TokenReward, 50 * 10**18, 5, 30, "{}");
        _createPerkInternal("Extra Break", "30 minute extra break", PerkType.ExtraBreak, 0, 3, 7, "{}");
        _createPerkInternal("Premium Parking", "Reserved parking spot for a week", PerkType.ParkingSpot, 0, 2, 7, "{}");
        _createPerkInternal("Coffee Voucher", "Free coffee for a week", PerkType.CoffeeVoucher, 0, 10, 7, "{}");
        _createPerkInternal("Flex Time", "Flexible working hours for a week", PerkType.FlexTime, 0, 5, 7, "{}");
        _createPerkInternal("Work From Home", "Work from home day", PerkType.HomeOffice, 0, 8, 30, "{}");
    }
    
    function _createPerkInternal(
        string memory name,
        string memory description,
        PerkType perkType,
        uint256 tokenValue,
        uint256 quantity,
        uint256 validityDays,
        string memory metadata
    ) internal returns (uint256) {
        require(bytes(name).length > 0, "Perk name cannot be empty");
        require(quantity > 0, "Quantity must be greater than 0");
        
        uint256 perkId = nextPerkId++;
        
        perks[perkId] = Perk({
            id: perkId,
            name: name,
            description: description,
            perkType: perkType,
            tokenValue: tokenValue,
            quantity: quantity,
            validityDays: validityDays,
            isActive: true,
            metadata: metadata
        });
        
        emit PerkCreated(perkId, name, perkType);
        
        return perkId;
    }
    
    function _findTicketOwner(uint256 roundId, uint256 ticketNumber) internal view returns (address) {
        address[] memory participants = lotteryRounds[roundId].participants;
        
        for (uint256 i = 0; i < participants.length; i++) {
            UserTicket[] memory tickets = userTickets[participants[i]];
            for (uint256 j = 0; j < tickets.length; j++) {
                if (tickets[j].roundId == roundId && tickets[j].ticketNumber == ticketNumber) {
                    return participants[i];
                }
            }
        }
        
        return address(0);
    }
    
    function _markUserTicketsAsWinners(uint256 roundId, address user) internal {
        UserTicket[] storage tickets = userTickets[user];
        for (uint256 i = 0; i < tickets.length; i++) {
            if (tickets[i].roundId == roundId) {
                tickets[i].isWinner = true;
            }
        }
    }
    
    function _userHasPerk(address user, uint256 perkId) internal view returns (bool) {
        uint256[] memory wonPerks = userWonPerks[user];
        for (uint256 i = 0; i < wonPerks.length; i++) {
            if (wonPerks[i] == perkId) {
                return true;
            }
        }
        return false;
    }
    
    function _removePerkFromUser(address user, uint256 perkId) internal {
        uint256[] storage wonPerks = userWonPerks[user];
        for (uint256 i = 0; i < wonPerks.length; i++) {
            if (wonPerks[i] == perkId) {
                wonPerks[i] = wonPerks[wonPerks.length - 1];
                wonPerks.pop();
                break;
            }
        }
    }
    
    function _endLotteryRound(uint256 roundId) internal {
        lotteryRounds[roundId].isComplete = true;
        if (currentRoundId == roundId) {
            currentRoundId = 0;
        }
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
