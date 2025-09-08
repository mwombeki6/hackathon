// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract BlockEngageToken is ERC20, Ownable, Pausable {
    mapping(address => bool) public authorizedMinters;
    mapping(address => uint256) public userTotalEarned;
    mapping(address => uint256) public userTotalSpent;
    
    event TokensAwarded(address indexed user, uint256 amount, string reason);
    event TokensSpent(address indexed user, uint256 amount, string purpose);
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);

    constructor() ERC20("BlockEngage Token", "BET") Ownable(msg.sender) {
        authorizedMinters[msg.sender] = true;
    }

    modifier onlyMinter() {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        _;
    }

    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }

    function awardTokens(address user, uint256 amount, string memory reason) external onlyMinter whenNotPaused {
        _mint(user, amount);
        userTotalEarned[user] += amount;
        emit TokensAwarded(user, amount, reason);
    }

    function spendTokens(address user, uint256 amount, string memory purpose) external onlyMinter whenNotPaused {
        require(balanceOf(user) >= amount, "Insufficient token balance");
        _burn(user, amount);
        userTotalSpent[user] += amount;
        emit TokensSpent(user, amount, purpose);
    }

    function batchAwardTokens(
        address[] memory users, 
        uint256[] memory amounts, 
        string memory reason
    ) external onlyMinter whenNotPaused {
        require(users.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            _mint(users[i], amounts[i]);
            userTotalEarned[users[i]] += amounts[i];
            emit TokensAwarded(users[i], amounts[i], reason);
        }
    }

    function getUserStats(address user) external view returns (
        uint256 balance,
        uint256 totalEarned,
        uint256 totalSpent
    ) {
        return (balanceOf(user), userTotalEarned[user], userTotalSpent[user]);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
