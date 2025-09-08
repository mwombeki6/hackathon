const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { updateStreak } = require('../services/streakService');

const router = express.Router();

// Get all tasks for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, assignedTo } = req.query;
    let query = `
      SELECT t.*, 
             creator.username as creator_name,
             assignee.username as assignee_name,
             reviewer.username as reviewer_name
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users reviewer ON t.reviewed_by = reviewer.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'team_member') {
      query += ' AND (t.assigned_to = $1 OR t.created_by = $1)';
      params.push(req.user.id);
    }

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    if (assignedTo) {
      params.push(assignedTo);
      query += ` AND t.assigned_to = $${params.length}`;
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create new task
router.post('/', authenticateToken, requireRole(['project_lead', 'admin']), [
  body('title').isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isLength({ max: 1000 }),
  body('assignedTo').isInt(),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']),
  body('estimatedHours').optional().isInt({ min: 1 }),
  body('dueDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      assignedTo,
      priority,
      estimatedHours,
      dueDate,
      tokenReward
    } = req.body;

    // Verify assignee exists
    const assignee = await db.query('SELECT * FROM users WHERE id = ?', [assignedTo]);
    if (assignee.rows.length === 0) {
      return res.status(400).json({ error: 'Assignee not found' });
    }

    const reward = tokenReward || 10;

    // Insert task into database
    const result = await db.query(`
      INSERT INTO tasks (title, description, priority, assigned_to, created_by, estimated_hours, due_date, token_reward)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [title, description, priority, assignedTo, req.user.id, estimatedHours, dueDate, reward]);

    const task = result.rows[0];

    // Create task on blockchain
    let blockchainData = { txHash: null, taskId: null };
    try {
      const deadline = dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      blockchainData = await blockchain.createTaskOnChain(
        title,
        description || '',
        assignee.rows[0].wallet_address,
        priority,
        deadline,
        [] // tags array - can be expanded later
      );

      // Update task with blockchain data
      if (blockchainData.txHash) {
        await db.query(
          'UPDATE tasks SET blockchain_tx_hash = ?, blockchain_task_id = ? WHERE id = ?', 
          [blockchainData.txHash, blockchainData.taskId, task.id]
        );
        task.blockchain_tx_hash = blockchainData.txHash;
        task.blockchain_task_id = blockchainData.taskId;
      }
    } catch (blockchainError) {
      console.error('Blockchain task creation failed:', blockchainError);
      // Continue without blockchain - can be retried later
    }

    // Record assignment
    await db.query(`
      INSERT INTO task_assignments (task_id, assigned_to, assigned_by)
      VALUES (?, ?, ?)
    `, [task.id, assignedTo, req.user.id]);

    // Emit real-time notification
    req.io?.to(`user-${assignedTo}`).emit('task-assigned', {
      task: {
        ...task,
        creator_name: req.user.username,
        assignee_name: assignee.rows[0].username
      },
      assignedBy: req.user.username
    });

    res.status(201).json({
      ...task,
      creator_name: req.user.username,
      assignee_name: assignee.rows[0].username
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Start task (change status to in_progress)
router.patch('/:id/start', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Get task and verify permissions
    const taskResult = await db.query(
      'SELECT t.*, u.wallet_address FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.id = ?', 
      [taskId]
    );
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = taskResult.rows[0];
    
    // Verify user is assignee
    if (task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Only assignee can start task' });
    }
    
    if (task.status !== 'pending') {
      return res.status(400).json({ error: 'Task cannot be started' });
    }
    
    // Update database
    await db.query('UPDATE tasks SET status = ? WHERE id = ?', ['in_progress', taskId]);
    
    // Update blockchain if task was created on blockchain
    let blockchainTxHash = null;
    if (task.blockchain_task_id) {
      try {
        blockchainTxHash = await blockchain.startTaskOnChain(task.blockchain_task_id, task.wallet_address);
      } catch (blockchainError) {
        console.error('Blockchain start task failed:', blockchainError);
      }
    }
    
    // Emit real-time update
    req.io?.emit('task-started', { taskId, status: 'in_progress', blockchainTxHash });
    
    res.json({ 
      message: 'Task started successfully',
      status: 'in_progress',
      blockchainTxHash
    });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

// Complete task
router.patch('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Get task and verify permissions
    const taskResult = await db.query(
      'SELECT t.*, u.wallet_address FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.id = ?', 
      [taskId]
    );
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = taskResult.rows[0];
    
    // Verify user is assignee
    if (task.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Only assignee can complete task' });
    }
    
    if (task.status !== 'in_progress') {
      return res.status(400).json({ error: 'Task must be in progress to complete' });
    }
    
    const completionDate = new Date();
    
    // Update database
    await db.query(
      'UPDATE tasks SET status = ?, completion_date = ? WHERE id = ?', 
      ['completed', completionDate, taskId]
    );
    
    // Complete task on blockchain
    let blockchainResult = { txHash: null, rewardAmount: '0' };
    if (task.blockchain_task_id) {
      try {
        blockchainResult = await blockchain.completeTaskOnChain(task.blockchain_task_id, task.wallet_address);
      } catch (blockchainError) {
        console.error('Blockchain complete task failed:', blockchainError);
      }
    }
    
    // Update streak
    try {
      const streakResult = await updateStreak(req.user.id);
      console.log('Streak updated:', streakResult);
    } catch (streakError) {
      console.error('Streak update failed:', streakError);
    }
    
    // Emit real-time update
    req.io?.emit('task-completed', { 
      taskId, 
      status: 'completed',
      completedBy: req.user.username,
      rewardAmount: blockchainResult.rewardAmount,
      blockchainTxHash: blockchainResult.txHash
    });
    
    res.json({ 
      message: 'Task completed successfully',
      status: 'completed',
      completionDate,
      rewardAmount: blockchainResult.rewardAmount,
      blockchainTxHash: blockchainResult.txHash
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Verify task (for reviewers/admins)
router.patch('/:id/verify', authenticateToken, requireRole(['reviewer', 'admin']), async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Get task
    const taskResult = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = taskResult.rows[0];
    
    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Task must be completed to verify' });
    }
    
    // Update database
    await db.query('UPDATE tasks SET reviewed_by = ? WHERE id = ?', [req.user.id, taskId]);
    
    // Verify on blockchain
    let blockchainTxHash = null;
    if (task.blockchain_task_id) {
      try {
        blockchainTxHash = await blockchain.verifyTaskOnChain(task.blockchain_task_id, req.user.wallet_address);
      } catch (blockchainError) {
        console.error('Blockchain verify task failed:', blockchainError);
      }
    }
    
    // Emit real-time update
    req.io?.emit('task-verified', { 
      taskId, 
      verifiedBy: req.user.username,
      blockchainTxHash
    });
    
    res.json({ 
      message: 'Task verified successfully',
      verifiedBy: req.user.username,
      blockchainTxHash
    });
  } catch (error) {
    console.error('Verify task error:', error);
    res.status(500).json({ error: 'Failed to verify task' });
  }
});

// Get task details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    const result = await db.query(`
      SELECT t.*, 
             creator.username as creator_name,
             assignee.username as assignee_name,
             reviewer.username as reviewer_name
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users reviewer ON t.reviewed_by = reviewer.id
      WHERE t.id = $1
    `, [taskId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result.rows[0];

    // Check permissions
    if (req.user.role !== 'admin' && 
        req.user.id !== task.assigned_to && 
        req.user.id !== task.created_by) {
      return res.status(403).json({ error: 'Not authorized to view this task' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update task details
router.patch('/:id', authenticateToken, requireRole(['project_lead', 'admin']), [
  body('title').optional().isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isLength({ max: 1000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('estimatedHours').optional().isInt({ min: 1 }),
  body('dueDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskId = req.params.id;
    const updates = req.body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (['title', 'description', 'priority', 'estimatedHours', 'dueDate'].includes(key)) {
        fields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId);

    const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', authenticateToken, requireRole(['project_lead', 'admin']), async (req, res) => {
  try {
    const taskId = req.params.id;
    
    const result = await db.query('DELETE FROM tasks WHERE id = ? RETURNING *', [taskId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
