// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TaskManager is Ownable, ReentrancyGuard {
    BlockEngageToken public immutable token;
    
    struct Task {
        uint256 id;
        address creator;
        address assignee;
        string title;
        string description;
        uint256 tokenReward;
        uint256 deadline;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }
    
    enum TaskStatus { Pending, InProgress, Completed, Cancelled, Overdue }
    
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256[]) public userTasks;
    mapping(address => uint256) public userCompletedTasks;
    
    uint256 public nextTaskId = 1;
    uint256 public constant BASE_REWARD = 10;
    uint256 public constant STREAK_BONUS_MULTIPLIER = 2;
    
    event TaskCreated(uint256 indexed taskId, address indexed creator, address indexed assignee);
    event TaskStatusUpdated(uint256 indexed taskId, TaskStatus status);
    event TaskCompleted(uint256 indexed taskId, address indexed assignee, uint256 tokensAwarded);
    event TaskEscalated(uint256 indexed taskId, address indexed assignee);
    
    constructor(address _tokenAddress) {
        token = BlockEngageToken(_tokenAddress);
    }
    
    function createTask(
        address assignee,
        string memory title,
        string memory description,
        uint256 deadline,
        uint256 customReward
    ) external returns (uint256) {
        require(assignee != address(0), "Invalid assignee");
        require(deadline > block.timestamp, "Deadline must be in future");
        
        uint256 taskId = nextTaskId++;
        uint256 reward = customReward > 0 ? customReward : BASE_REWARD;
        
        tasks[taskId] = Task({
            id: taskId,
            creator: msg.sender,
            assignee: assignee,
            title: title,
            description: description,
            tokenReward: reward,
            deadline: deadline,
            status: TaskStatus.Pending,
            createdAt: block.timestamp,
            completedAt: 0
        });
        
        userTasks[assignee].push(taskId);
        
        emit TaskCreated(taskId, msg.sender, assignee);
        return taskId;
    }
    
    function updateTaskStatus(uint256 taskId, TaskStatus status) external {
        Task storage task = tasks[taskId];
        require(task.id != 0, "Task does not exist");
        require(
            msg.sender == task.assignee || msg.sender == task.creator || msg.sender == owner(),
            "Not authorized"
        );
        
        task.status = status;
        emit TaskStatusUpdated(taskId, status);
    }
    
    function completeTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.id != 0, "Task does not exist");
        require(msg.sender == task.assignee, "Only assignee can complete");
        require(task.status != TaskStatus.Completed, "Task already completed");
        
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;
        
        // Calculate bonus for early completion
        uint256 bonus = 0;
        if (block.timestamp < task.deadline) {
            uint256 timeLeft = task.deadline - block.timestamp;
            uint256 totalTime = task.deadline - task.createdAt;
            if (timeLeft > totalTime / 2) { // Completed in first half of time
                bonus = task.tokenReward / 2;
            }
        }
        
        uint256 totalReward = task.tokenReward + bonus;
        userCompletedTasks[task.assignee]++;
        
        // Award tokens
        token.awardTokens(task.assignee, totalReward, "Task completion");
        
        emit TaskCompleted(taskId, task.assignee, totalReward);
    }
    
    function escalateOverdueTasks() external {
        // This would be called by a cron job or keeper network
        // For now, simplified version
        for (uint256 i = 1; i < nextTaskId; i++) {
            Task storage task = tasks[i];
            if (task.status == TaskStatus.Pending || task.status == TaskStatus.InProgress) {
                if (block.timestamp > task.deadline) {
                    task.status = TaskStatus.Overdue;
                    emit TaskEscalated(i, task.assignee);
                }
            }
        }
    }
    
    function getUserTasks(address user) external view returns (uint256[] memory) {
        return userTasks[user];
    }
    
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
    
    function getUserStats(address user) external view returns (
        uint256 totalTasks,
        uint256 completedTasks,
        uint256 pendingTasks
    ) {
        uint256[] memory userTaskIds = userTasks[user];
        uint256 completed = 0;
        uint256 pending = 0;
        
        for (uint256 i = 0; i < userTaskIds.length; i++) {
            TaskStatus status = tasks[userTaskIds[i]].status;
            if (status == TaskStatus.Completed) {
                completed++;
            } else if (status == TaskStatus.Pending || status == TaskStatus.InProgress) {
                pending++;
            }
        }
        
        return (userTaskIds.length, completed, pending);
    }
}
