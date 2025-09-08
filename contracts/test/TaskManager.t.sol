// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BlockEngageToken} from "../src/BlockEngageToken.sol";
import {TaskManager} from "../src/TaskManager.sol";

contract TaskManagerTest is Test {
    BlockEngageToken public betToken;
    TaskManager public taskManager;
    address public owner;
    address public user1;
    address public user2;
    address public verifier;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        verifier = makeAddr("verifier");
        
        betToken = new BlockEngageToken();
        taskManager = new TaskManager(address(betToken));
        
        // Authorize TaskManager as minter
        betToken.authorizeMinter(address(taskManager));
        
        // Authorize verifier
        taskManager.authorizeVerifier(verifier);
    }

    function testCreateTask() public {
        string[] memory tags = new string[](2);
        tags[0] = "urgent";
        tags[1] = "backend";
        
        uint256 taskId = taskManager.createTask(
            "Test Task",
            "This is a test task",
            user1,
            TaskManager.TaskPriority.Medium,
            block.timestamp + 1 days,
            tags
        );
        
        TaskManager.Task memory task = taskManager.getTask(taskId);
        
        assertEq(task.id, taskId);
        assertEq(task.title, "Test Task");
        assertEq(task.creator, owner);
        assertEq(task.assignee, user1);
        assertEq(uint(task.priority), uint(TaskManager.TaskPriority.Medium));
        assertEq(uint(task.status), uint(TaskManager.TaskStatus.Created));
    }

    function testStartTask() public {
        uint256 taskId = _createTestTask();
        
        vm.prank(user1);
        taskManager.startTask(taskId);
        
        TaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint(task.status), uint(TaskManager.TaskStatus.InProgress));
    }

    function testCompleteTask() public {
        uint256 taskId = _createTestTask();
        
        vm.prank(user1);
        taskManager.startTask(taskId);
        
        vm.prank(user1);
        taskManager.completeTask(taskId);
        
        TaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint(task.status), uint(TaskManager.TaskStatus.Completed));
        assertTrue(task.completedAt > 0);
        
        // Check that user received tokens
        assertTrue(betToken.balanceOf(user1) > 0);
    }

    function testVerifyTask() public {
        uint256 taskId = _createTestTask();
        
        vm.prank(user1);
        taskManager.startTask(taskId);
        
        vm.prank(user1);
        taskManager.completeTask(taskId);
        
        vm.prank(verifier);
        taskManager.verifyTask(taskId);
        
        TaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint(task.status), uint(TaskManager.TaskStatus.Verified));
        assertTrue(task.isVerified);
        
        // Check that verifier received tokens
        assertTrue(betToken.balanceOf(verifier) > 0);
    }

    function testStreakCalculation() public {
        // Create multiple tasks for streak testing
        uint256 taskId1 = _createTestTask();
        uint256 taskId2 = _createTestTask();
        
        // Complete first task
        vm.prank(user1);
        taskManager.startTask(taskId1);
        vm.prank(user1);
        taskManager.completeTask(taskId1);
        
        TaskManager.UserStats memory stats1 = taskManager.getUserStats(user1);
        assertEq(stats1.currentStreak, 1);
        
        // Complete second task on same day (no streak increase)
        vm.prank(user1);
        taskManager.startTask(taskId2);
        vm.prank(user1);
        taskManager.completeTask(taskId2);
        
        TaskManager.UserStats memory stats2 = taskManager.getUserStats(user1);
        assertEq(stats2.currentStreak, 1); // Same day, no streak change
        assertEq(stats2.tasksCompleted, 2);
    }

    function testCancelTask() public {
        uint256 taskId = _createTestTask();
        
        vm.prank(user1);
        taskManager.cancelTask(taskId);
        
        TaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint(task.status), uint(TaskManager.TaskStatus.Cancelled));
    }

    function testGetUserTasks() public {
        uint256 taskId1 = _createTestTask();
        uint256 taskId2 = taskManager.createTask(
            "Second Task",
            "Another test task",
            user1,
            TaskManager.TaskPriority.High,
            block.timestamp + 2 days,
            new string[](0)
        );
        
        uint256[] memory userTasks = taskManager.getUserTasks(user1);
        assertEq(userTasks.length, 2);
        assertEq(userTasks[0], taskId1);
        assertEq(userTasks[1], taskId2);
    }

    function testRewardCalculation() public {
        // Test different priority rewards
        uint256 lowTaskId = taskManager.createTask(
            "Low Priority",
            "Low priority task",
            user1,
            TaskManager.TaskPriority.Low,
            block.timestamp + 1 days,
            new string[](0)
        );
        
        uint256 criticalTaskId = taskManager.createTask(
            "Critical Priority",
            "Critical priority task",
            user2,
            TaskManager.TaskPriority.Critical,
            block.timestamp + 1 days,
            new string[](0)
        );
        
        TaskManager.Task memory lowTask = taskManager.getTask(lowTaskId);
        TaskManager.Task memory criticalTask = taskManager.getTask(criticalTaskId);
        
        // Critical task should have 3x the reward of low priority
        assertEq(criticalTask.rewardAmount, lowTask.rewardAmount * 3);
    }

    function testOnlyAssigneeCanComplete() public {
        uint256 taskId = _createTestTask();
        
        vm.prank(user1);
        taskManager.startTask(taskId);
        
        vm.prank(user2);
        vm.expectRevert("Only assignee can complete task");
        taskManager.completeTask(taskId);
    }

    function testOnlyVerifierCanVerify() public {
        uint256 taskId = _createTestTask();
        
        vm.prank(user1);
        taskManager.startTask(taskId);
        vm.prank(user1);
        taskManager.completeTask(taskId);
        
        vm.prank(user2);
        vm.expectRevert("Not authorized to verify tasks");
        taskManager.verifyTask(taskId);
    }

    function _createTestTask() internal returns (uint256) {
        return taskManager.createTask(
            "Test Task",
            "This is a test task",
            user1,
            TaskManager.TaskPriority.Medium,
            block.timestamp + 1 days,
            new string[](0)
        );
    }
}
