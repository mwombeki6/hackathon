// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlockEngageToken.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/Pausable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract TaskManager is Ownable, Pausable, ReentrancyGuard {
    BlockEngageToken public betToken;
    
    enum TaskStatus { Created, InProgress, Completed, Verified, Cancelled }
    enum TaskPriority { Low, Medium, High, Critical }
    
    struct Task {
        uint256 id;
        string title;
        string description;
        address creator;
        address assignee;
        TaskPriority priority;
        TaskStatus status;
        uint256 rewardAmount;
        uint256 createdAt;
        uint256 dueDate;
        uint256 completedAt;
        bool isVerified;
        string[] tags;
    }
    
    struct UserStats {
        uint256 tasksCreated;
        uint256 tasksCompleted;
        uint256 tasksVerified;
        uint256 totalRewardsEarned;
        uint256 currentStreak;
        uint256 lastCompletionDate;
        uint256 maxStreak;
    }
    
    mapping(uint256 => Task) public tasks;
    mapping(address => UserStats) public userStats;
    mapping(address => uint256[]) public userTasks;
    mapping(address => uint256[]) public userCreatedTasks;
    mapping(address => bool) public authorizedVerifiers;
    
    uint256 public nextTaskId = 1;
    uint256 public constant COMPLETION_REWARD = 10 * 10**18; // 10 BET tokens
    uint256 public constant VERIFICATION_REWARD = 5 * 10**18; // 5 BET tokens
    uint256 public constant STREAK_BONUS = 2 * 10**18; // 2 BET tokens per day in streak
    uint256 public constant MAX_STREAK_BONUS = 50 * 10**18; // Cap at 50 BET tokens
    
    event TaskCreated(uint256 indexed taskId, address indexed creator, address indexed assignee, string title);
    event TaskStatusChanged(uint256 indexed taskId, TaskStatus oldStatus, TaskStatus newStatus);
    event TaskCompleted(uint256 indexed taskId, address indexed assignee, uint256 rewardAmount);
    event TaskVerified(uint256 indexed taskId, address indexed verifier, uint256 bonusReward);
    event StreakUpdated(address indexed user, uint256 newStreak, uint256 bonusReward);
    event VerifierAuthorized(address indexed verifier);
    event VerifierRevoked(address indexed verifier);
    
    constructor(address _betTokenAddress) Ownable(msg.sender) {
        betToken = BlockEngageToken(_betTokenAddress);
        authorizedVerifiers[msg.sender] = true;
    }
    
    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender], "Not authorized to verify tasks");
        _;
    }
    
    modifier taskExists(uint256 taskId) {
        require(taskId > 0 && taskId < nextTaskId, "Task does not exist");
        _;
    }
    
    function authorizeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = true;
        emit VerifierAuthorized(verifier);
    }
    
    function revokeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = false;
        emit VerifierRevoked(verifier);
    }
    
    function createTask(
        string memory title,
        string memory description,
        address assignee,
        TaskPriority priority,
        uint256 dueDate,
        string[] memory tags
    ) external whenNotPaused returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(assignee != address(0), "Invalid assignee address");
        require(dueDate > block.timestamp, "Due date must be in the future");
        
        uint256 taskId = nextTaskId++;
        
        tasks[taskId] = Task({
            id: taskId,
            title: title,
            description: description,
            creator: msg.sender,
            assignee: assignee,
            priority: priority,
            status: TaskStatus.Created,
            rewardAmount: _calculateReward(priority),
            createdAt: block.timestamp,
            dueDate: dueDate,
            completedAt: 0,
            isVerified: false,
            tags: tags
        });
        
        userTasks[assignee].push(taskId);
        userCreatedTasks[msg.sender].push(taskId);
        userStats[msg.sender].tasksCreated++;
        
        emit TaskCreated(taskId, msg.sender, assignee, title);
        
        return taskId;
    }
    
    function startTask(uint256 taskId) external taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.assignee == msg.sender, "Only assignee can start task");
        require(task.status == TaskStatus.Created, "Task cannot be started");
        
        TaskStatus oldStatus = task.status;
        task.status = TaskStatus.InProgress;
        
        emit TaskStatusChanged(taskId, oldStatus, TaskStatus.InProgress);
    }
    
    function completeTask(uint256 taskId) external taskExists(taskId) whenNotPaused nonReentrant {
        Task storage task = tasks[taskId];
        require(task.assignee == msg.sender, "Only assignee can complete task");
        require(task.status == TaskStatus.InProgress, "Task must be in progress");
        
        TaskStatus oldStatus = task.status;
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;
        
        // Update user stats and calculate streak
        UserStats storage stats = userStats[msg.sender];
        stats.tasksCompleted++;
        
        uint256 totalReward = task.rewardAmount;
        
        // Calculate streak bonus
        uint256 streakBonus = _updateStreak(msg.sender);
        totalReward += streakBonus;
        
        stats.totalRewardsEarned += totalReward;
        
        // Award tokens
        betToken.awardTokens(msg.sender, totalReward, "Task completion");
        
        emit TaskStatusChanged(taskId, oldStatus, TaskStatus.Completed);
        emit TaskCompleted(taskId, msg.sender, totalReward);
    }
    
    function verifyTask(uint256 taskId) external taskExists(taskId) onlyVerifier whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Completed, "Task must be completed");
        require(!task.isVerified, "Task already verified");
        
        TaskStatus oldStatus = task.status;
        task.status = TaskStatus.Verified;
        task.isVerified = true;
        
        // Update verifier stats
        userStats[msg.sender].tasksVerified++;
        
        // Award verification bonus to verifier
        betToken.awardTokens(msg.sender, VERIFICATION_REWARD, "Task verification");
        
        emit TaskStatusChanged(taskId, oldStatus, TaskStatus.Verified);
        emit TaskVerified(taskId, msg.sender, VERIFICATION_REWARD);
    }
    
    function cancelTask(uint256 taskId) external taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];
        require(
            task.creator == msg.sender || task.assignee == msg.sender,
            "Only creator or assignee can cancel task"
        );
        require(
            task.status == TaskStatus.Created || task.status == TaskStatus.InProgress,
            "Cannot cancel completed task"
        );
        
        TaskStatus oldStatus = task.status;
        task.status = TaskStatus.Cancelled;
        
        emit TaskStatusChanged(taskId, oldStatus, TaskStatus.Cancelled);
    }
    
    function getTask(uint256 taskId) external view taskExists(taskId) returns (Task memory) {
        return tasks[taskId];
    }
    
    function getUserTasks(address user) external view returns (uint256[] memory) {
        return userTasks[user];
    }
    
    function getUserCreatedTasks(address user) external view returns (uint256[] memory) {
        return userCreatedTasks[user];
    }
    
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }
    
    function _calculateReward(TaskPriority priority) internal pure returns (uint256) {
        if (priority == TaskPriority.Critical) return COMPLETION_REWARD * 3;
        if (priority == TaskPriority.High) return COMPLETION_REWARD * 2;
        if (priority == TaskPriority.Medium) return COMPLETION_REWARD * 3 / 2;
        return COMPLETION_REWARD;
    }
    
    function _updateStreak(address user) internal returns (uint256) {
        UserStats storage stats = userStats[user];
        uint256 today = block.timestamp / 86400; // Convert to days
        uint256 lastDay = stats.lastCompletionDate / 86400;
        
        uint256 streakBonus = 0;
        
        if (lastDay == 0) {
            // First task completion
            stats.currentStreak = 1;
        } else if (today == lastDay + 1) {
            // Consecutive day
            stats.currentStreak++;
        } else if (today == lastDay) {
            // Same day, no streak change
            return 0;
        } else {
            // Streak broken
            stats.currentStreak = 1;
        }
        
        // Update max streak
        if (stats.currentStreak > stats.maxStreak) {
            stats.maxStreak = stats.currentStreak;
        }
        
        // Calculate streak bonus (capped)
        streakBonus = stats.currentStreak * STREAK_BONUS;
        if (streakBonus > MAX_STREAK_BONUS) {
            streakBonus = MAX_STREAK_BONUS;
        }
        
        stats.lastCompletionDate = block.timestamp;
        
        emit StreakUpdated(user, stats.currentStreak, streakBonus);
        
        return streakBonus;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
