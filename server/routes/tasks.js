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
    try {
      const deadline = dueDate ? Math.floor(new Date(dueDate).getTime() / 1000) : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const txHash = await blockchain.createTaskOnChain(
        assignee.rows[0].wallet_address,
        title,
        description || '',
        deadline,
        reward
      );

      // Update task with blockchain transaction hash
      await db.query('UPDATE tasks SET blockchain_tx_hash = ? WHERE id = ?', [txHash, task.id]);
      task.blockchain_tx_hash = txHash;
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
    req.io.to(`user-${assignedTo}`).emit('task-assigned', {
      task,
      assignedBy: req.user.username
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['pending', 'in_progress', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskId = req.params.id;
    const { status } = req.body;

    // Get task
    const taskResult = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check permissions
    if (req.user.role !== 'admin' && 
        req.user.id !== task.assigned_to && 
        req.user.id !== task.created_by) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }

    // Update task status
    const updateResult = await db.query(`
      UPDATE tasks 
      SET status = ?, updated_at = datetime('now'),
          completion_date = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completion_date END
      WHERE id = ?
      RETURNING *
    `, [status, status, taskId]);

    const updatedTask = updateResult.rows[0];

    // Handle task completion
    if (status === 'completed' && task.status !== 'completed') {
      // Update user streak
      await updateStreak(task.assigned_to);

      // Award tokens via blockchain
      try {
        const assignee = await db.query('SELECT wallet_address FROM users WHERE id = ?', [task.assigned_to]);
        if (assignee.rows.length > 0) {
          await blockchain.awardTokens(assignee.rows[0].wallet_address, task.token_reward, 'Task completion');
          
          // Issue lottery ticket
          await blockchain.issueTicket(assignee.rows[0].wallet_address, 'Task completion');
        }
      } catch (blockchainError) {
        console.error('Blockchain reward failed:', blockchainError);
      }

      // Log activity
      await db.query(`
        INSERT INTO user_activities (user_id, activity_date, activity_type, points_earned)
        VALUES (?, date('now'), 'task_completed', ?)
      `, [task.assigned_to, task.token_reward]);

      // Update user total tokens
      await db.query('UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?', 
        [task.token_reward, task.assigned_to]);

      // Emit completion notification
      req.io.to(`user-${task.created_by}`).emit('task-completed', {
        task: updatedTask,
        completedBy: req.user.username
      });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
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
