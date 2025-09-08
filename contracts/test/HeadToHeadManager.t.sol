// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BlockEngageToken} from "../src/BlockEngageToken.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {HeadToHeadManager} from "../src/HeadToHeadManager.sol";

contract HeadToHeadManagerTest is Test {
    BlockEngageToken public betToken;
    TaskManager public taskManager;
    HeadToHeadManager public h2hManager;
    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        betToken = new BlockEngageToken();
        taskManager = new TaskManager(address(betToken));
        h2hManager = new HeadToHeadManager(address(betToken), address(taskManager));
        
        // Authorize contracts as minters
        betToken.authorizeMinter(address(taskManager));
        betToken.authorizeMinter(address(h2hManager));
        
        // Give users some tokens for wagering
        betToken.awardTokens(user1, 1000 * 10**18, "Initial tokens");
        betToken.awardTokens(user2, 1000 * 10**18, "Initial tokens");
    }

    function testCreateChallenge() public {
        vm.prank(user1);
        uint256 challengeId = h2hManager.createChallenge(
            user2,
            HeadToHeadManager.ChallengeType.TaskCompletion,
            100 * 10**18, // 100 BET wager
            7 days,
            5, // Target: complete 5 tasks
            "Who can complete more tasks?",
            true
        );
        
        HeadToHeadManager.Challenge memory challenge = h2hManager.getChallenge(challengeId);
        
        assertEq(challenge.challenger, user1);
        assertEq(challenge.opponent, user2);
        assertEq(challenge.wagerAmount, 100 * 10**18);
        assertEq(uint(challenge.status), uint(HeadToHeadManager.ChallengeStatus.Created));
        
        // Check that challenger's tokens were locked
        assertEq(betToken.balanceOf(user1), 900 * 10**18);
    }

    function testAcceptChallenge() public {
        uint256 challengeId = _createTestChallenge();
        
        vm.prank(user2);
        h2hManager.acceptChallenge(challengeId);
        
        HeadToHeadManager.Challenge memory challenge = h2hManager.getChallenge(challengeId);
        
        assertEq(uint(challenge.status), uint(HeadToHeadManager.ChallengeStatus.Active));
        assertTrue(challenge.startTime > 0);
        assertTrue(challenge.endTime > challenge.startTime);
        
        // Check that opponent's tokens were also locked
        assertEq(betToken.balanceOf(user2), 900 * 10**18);
    }

    function testCancelChallenge() public {
        uint256 challengeId = _createTestChallenge();
        
        vm.prank(user1);
        h2hManager.cancelChallenge(challengeId);
        
        HeadToHeadManager.Challenge memory challenge = h2hManager.getChallenge(challengeId);
        assertEq(uint(challenge.status), uint(HeadToHeadManager.ChallengeStatus.Cancelled));
        
        // Check that challenger got refund
        assertEq(betToken.balanceOf(user1), 1000 * 10**18);
    }

    function testCompleteChallenge() public {
        uint256 challengeId = _createTestChallenge();
        
        vm.prank(user2);
        h2hManager.acceptChallenge(challengeId);
        
        // Simulate some task completions for user1
        _simulateTaskCompletions(user1, 3);
        _simulateTaskCompletions(user2, 1);
        
        // Fast forward past challenge end time
        vm.warp(block.timestamp + 8 days);
        
        vm.prank(user1);
        h2hManager.completeChallenge(challengeId);
        
        HeadToHeadManager.Challenge memory challenge = h2hManager.getChallenge(challengeId);
        
        assertEq(uint(challenge.status), uint(HeadToHeadManager.ChallengeStatus.Completed));
        assertEq(challenge.winner, user1);
        assertTrue(challenge.challengerScore > challenge.opponentScore);
        
        // Check that winner received tokens (minus platform fee)
        assertTrue(betToken.balanceOf(user1) > 900 * 10**18);
    }

    function testGetUserStats() public {
        uint256 challengeId = _createTestChallenge();
        
        vm.prank(user2);
        h2hManager.acceptChallenge(challengeId);
        
        HeadToHeadManager.UserStats memory stats1 = h2hManager.getUserStats(user1);
        HeadToHeadManager.UserStats memory stats2 = h2hManager.getUserStats(user2);
        
        assertEq(stats1.challengesCreated, 1);
        assertEq(stats2.challengesAccepted, 1);
        assertEq(stats1.totalWagered, 100 * 10**18);
        assertEq(stats2.totalWagered, 100 * 10**18);
    }

    function testGetPendingChallenges() public {
        uint256 challengeId = _createTestChallenge();
        
        uint256[] memory pending = h2hManager.getPendingChallenges(user2);
        assertEq(pending.length, 1);
        assertEq(pending[0], challengeId);
        
        // After accepting, should be removed from pending
        vm.prank(user2);
        h2hManager.acceptChallenge(challengeId);
        
        pending = h2hManager.getPendingChallenges(user2);
        assertEq(pending.length, 0);
    }

    function testInvalidWagerAmount() public {
        vm.prank(user1);
        vm.expectRevert("Invalid wager amount");
        h2hManager.createChallenge(
            user2,
            HeadToHeadManager.ChallengeType.TaskCompletion,
            0, // Invalid: too low
            7 days,
            5,
            "Invalid wager",
            true
        );
    }

    function testCannotChallengeYourself() public {
        vm.prank(user1);
        vm.expectRevert("Cannot challenge yourself");
        h2hManager.createChallenge(
            user1, // Same as challenger
            HeadToHeadManager.ChallengeType.TaskCompletion,
            100 * 10**18,
            7 days,
            5,
            "Self challenge",
            true
        );
    }

    function testInsufficientTokensForWager() public {
        // First spend user1's tokens to make them insufficient
        vm.prank(user1);
        require(betToken.transfer(user2, 950 * 10**18), "Transfer failed"); // Leave user1 with only 50 tokens
        
        vm.prank(user1);
        vm.expectRevert("Insufficient tokens for wager");
        h2hManager.createChallenge(
            user2,
            HeadToHeadManager.ChallengeType.TaskCompletion,
            100 * 10**18, // More than user1 now has (50)
            7 days,
            5,
            "Too expensive",
            true
        );
    }

    function testOnlyOpponentCanAccept() public {
        uint256 challengeId = _createTestChallenge();
        
        vm.prank(user1); // Challenger trying to accept own challenge
        vm.expectRevert("Only opponent can perform this action");
        h2hManager.acceptChallenge(challengeId);
    }

    function _createTestChallenge() internal returns (uint256) {
        vm.prank(user1);
        return h2hManager.createChallenge(
            user2,
            HeadToHeadManager.ChallengeType.TaskCompletion,
            100 * 10**18,
            7 days,
            5,
            "Test challenge",
            true
        );
    }

    function _simulateTaskCompletions(address user, uint256 count) internal {
        for (uint256 i = 0; i < count; i++) {
            uint256 taskId = taskManager.createTask(
                string(abi.encodePacked("Task ", vm.toString(i))),
                "Test task",
                user,
                TaskManager.TaskPriority.Medium,
                block.timestamp + 1 days,
                new string[](0)
            );
            
            vm.prank(user);
            taskManager.startTask(taskId);
            
            vm.prank(user);
            taskManager.completeTask(taskId);
        }
    }
}
