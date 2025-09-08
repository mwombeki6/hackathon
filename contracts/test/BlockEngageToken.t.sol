// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BlockEngageToken} from "../src/BlockEngageToken.sol";

contract BlockEngageTokenTest is Test {
    BlockEngageToken public betToken;
    address public owner;
    address public user1;
    address public user2;
    address public minter;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        minter = makeAddr("minter");
        
        betToken = new BlockEngageToken();
    }

    function testInitialState() public view {
        assertEq(betToken.name(), "BlockEngage Token");
        assertEq(betToken.symbol(), "BET");
        assertEq(betToken.totalSupply(), 0);
        assertTrue(betToken.authorizedMinters(owner));
        assertFalse(betToken.authorizedMinters(user1));
    }

    function testAuthorizeMinter() public {
        betToken.authorizeMinter(minter);
        assertTrue(betToken.authorizedMinters(minter));
    }

    function testRevokeMinter() public {
        betToken.authorizeMinter(minter);
        assertTrue(betToken.authorizedMinters(minter));
        
        betToken.revokeMinter(minter);
        assertFalse(betToken.authorizedMinters(minter));
    }

    function testAwardTokens() public {
        uint256 amount = 100 * 10**18;
        
        betToken.awardTokens(user1, amount, "Test reward");
        
        assertEq(betToken.balanceOf(user1), amount);
        assertEq(betToken.userTotalEarned(user1), amount);
        assertEq(betToken.totalSupply(), amount);
    }

    function testSpendTokens() public {
        uint256 amount = 100 * 10**18;
        uint256 spendAmount = 30 * 10**18;
        
        // First award tokens
        betToken.awardTokens(user1, amount, "Test reward");
        
        // Then spend some
        betToken.spendTokens(user1, spendAmount, "Test purchase");
        
        assertEq(betToken.balanceOf(user1), amount - spendAmount);
        assertEq(betToken.userTotalSpent(user1), spendAmount);
        assertEq(betToken.totalSupply(), amount - spendAmount);
    }

    function testBatchAwardTokens() public {
        address[] memory users = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        
        users[0] = user1;
        users[1] = user2;
        amounts[0] = 50 * 10**18;
        amounts[1] = 75 * 10**18;
        
        betToken.batchAwardTokens(users, amounts, "Batch reward");
        
        assertEq(betToken.balanceOf(user1), amounts[0]);
        assertEq(betToken.balanceOf(user2), amounts[1]);
        assertEq(betToken.userTotalEarned(user1), amounts[0]);
        assertEq(betToken.userTotalEarned(user2), amounts[1]);
    }

    function testGetUserStats() public {
        uint256 earnedAmount = 100 * 10**18;
        uint256 spentAmount = 25 * 10**18;
        
        betToken.awardTokens(user1, earnedAmount, "Test reward");
        betToken.spendTokens(user1, spentAmount, "Test purchase");
        
        (uint256 balance, uint256 totalEarned, uint256 totalSpent) = betToken.getUserStats(user1);
        
        assertEq(balance, earnedAmount - spentAmount);
        assertEq(totalEarned, earnedAmount);
        assertEq(totalSpent, spentAmount);
    }

    function testOnlyMinterCanAward() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized to mint");
        betToken.awardTokens(user2, 100 * 10**18, "Unauthorized");
    }

    function testOnlyMinterCanSpend() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized to mint");
        betToken.spendTokens(user2, 100 * 10**18, "Unauthorized");
    }

    function testInsufficientBalanceForSpend() public {
        vm.expectRevert("Insufficient token balance");
        betToken.spendTokens(user1, 100 * 10**18, "No balance");
    }

    function testPauseUnpause() public {
        betToken.pause();
        
        vm.expectRevert();
        betToken.awardTokens(user1, 100 * 10**18, "Paused");
        
        betToken.unpause();
        
        // Should work after unpause
        betToken.awardTokens(user1, 100 * 10**18, "Unpaused");
        assertEq(betToken.balanceOf(user1), 100 * 10**18);
    }
}
