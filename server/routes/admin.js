const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin Dashboard Overview
router.get('/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get platform statistics
    const userStats = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as new_users_week,
        COUNT(CASE WHEN current_streak > 0 THEN 1 END) as active_users
      FROM users
    `);

    const taskStats = await db.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as tasks_this_week
      FROM tasks
    `);

    const leagueStats = await db.query(`
      SELECT 
        COUNT(DISTINCT l.id) as active_leagues,
        COUNT(ul.user_id) as total_league_members
      FROM leagues l
      LEFT JOIN user_leagues ul ON l.id = ul.league_id
      WHERE l.is_active = true
    `);

    const h2hStats = await db.query(`
      SELECT 
        COUNT(*) as total_challenges,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_challenges,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_challenges
      FROM head_to_head
    `);

    const tokenStats = await db.query(`
      SELECT 
        SUM(total_tokens) as total_tokens_distributed,
        AVG(total_tokens) as avg_tokens_per_user,
        MAX(total_tokens) as max_tokens
      FROM users
    `);

    // Get blockchain status
    let blockchainStats = null;
    try {
      blockchainStats = await blockchain.getBlockchainStats();
    } catch (error) {
      console.error('Failed to get blockchain stats:', error);
    }

    // Recent activities
    const recentActivities = await db.query(`
      SELECT 
        ua.activity_type,
        ua.points_earned,
        ua.activity_date,
        u.username
      FROM user_activities ua
      JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC
      LIMIT 20
    `);

    res.json({
      overview: {
        users: userStats.rows[0],
        tasks: taskStats.rows[0],
        leagues: leagueStats.rows[0],
        challenges: h2hStats.rows[0],
        tokens: tokenStats.rows[0]
      },
      blockchain: blockchainStats,
      recentActivities: recentActivities.rows
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch admin dashboard' });
  }
});

// User Management
router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = `WHERE (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    const validSortFields = ['username', 'full_name', 'total_tokens', 'current_streak', 'created_at'];
    const validSortOrders = ['ASC', 'DESC'];
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Get users with task statistics
    const users = await db.query(`
      SELECT 
        u.*,
        COALESCE(task_counts.total_tasks, 0) as total_tasks,
        COALESCE(task_counts.completed_tasks, 0) as completed_tasks,
        COALESCE(league_counts.leagues_joined, 0) as leagues_joined,
        COALESCE(h2h_counts.challenges_participated, 0) as challenges_participated
      FROM users u
      LEFT JOIN (
        SELECT 
          assigned_to,
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
        FROM tasks
        GROUP BY assigned_to
      ) task_counts ON u.id = task_counts.assigned_to
      LEFT JOIN (
        SELECT user_id, COUNT(*) as leagues_joined
        FROM user_leagues
        GROUP BY user_id
      ) league_counts ON u.id = league_counts.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as challenges_participated
        FROM (
          SELECT challenger_id as user_id FROM head_to_head
          UNION ALL
          SELECT opponent_id as user_id FROM head_to_head
        ) all_challenges
        GROUP BY user_id
      ) h2h_counts ON u.id = h2h_counts.user_id
      ${whereClause}
      ORDER BY u.${sortField} ${order}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination
    const totalCount = await db.query(`
      SELECT COUNT(*) as count FROM users u ${whereClause}
    `, params);

    res.json({
      users: users.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.rows[0].count,
        totalPages: Math.ceil(totalCount.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role or tokens
router.patch('/users/:id', authenticateToken, requireRole(['admin']), [
  body('role').optional().isIn(['team_member', 'project_lead', 'reviewer', 'admin']),
  body('totalTokens').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { role, totalTokens, isActive } = req.body;

    const updates = [];
    const params = [];

    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }

    if (totalTokens !== undefined) {
      updates.push('total_tokens = ?');
      params.push(totalTokens);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    params.push(userId);

    await db.query(`
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `, params);

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// System Configuration
router.get('/config', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get system configuration (could be from database or environment)
    const config = {
      platform: {
        name: 'BlockEngage',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      blockchain: {
        network: process.env.ALPHACHAIN_RPC_URL ? 'AlphachainLive' : 'Local',
        isConnected: blockchain.isConnected || false,
        contracts: {
          token: process.env.REWARD_TOKEN_CONTRACT || 'Not deployed',
          taskManager: process.env.TASK_MANAGER_CONTRACT || 'Not deployed',
          leagueManager: process.env.LEAGUE_CONTRACT || 'Not deployed',
          h2hManager: process.env.H2H_CONTRACT || 'Not deployed',
          lotteryManager: process.env.LOTTERY_CONTRACT || 'Not deployed'
        }
      },
      features: {
        taskManagement: true,
        leagues: true,
        headToHead: true,
        lottery: true,
        realTimeUpdates: true
      }
    };

    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Bulk Operations
router.post('/bulk/award-tokens', authenticateToken, requireRole(['admin']), [
  body('userIds').isArray().notEmpty(),
  body('amount').isInt({ min: 1 }),
  body('reason').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userIds, amount, reason } = req.body;

    // Get users and their wallet addresses
    const users = await db.query(`
      SELECT id, username, wallet_address FROM users WHERE id IN (${userIds.map(() => '?').join(',')})
    `, userIds);

    if (users.rows.length !== userIds.length) {
      return res.status(400).json({ error: 'Some users not found' });
    }

    try {
      await db.query('BEGIN TRANSACTION');

      // Update tokens in database
      await db.query(`
        UPDATE users 
        SET total_tokens = total_tokens + ? 
        WHERE id IN (${userIds.map(() => '?').join(',')})
      `, [amount, ...userIds]);

      // Log activities
      const activityPromises = userIds.map(userId =>
        db.query(`
          INSERT INTO user_activities (user_id, activity_date, activity_type, points_earned)
          VALUES (?, datetime('now'), 'admin_token_award', ?)
        `, [userId, amount])
      );
      await Promise.all(activityPromises);

      await db.query('COMMIT');

      // Award tokens on blockchain if available
      try {
        for (const user of users.rows) {
          if (user.wallet_address) {
            await blockchain.awardTokens(
              user.wallet_address,
              amount * 1e18,
              `Admin Award: ${reason}`
            );
          }
        }
      } catch (blockchainError) {
        console.error('Bulk blockchain token award failed:', blockchainError);
      }

      // Emit notifications
      users.rows.forEach(user => {
        req.io?.to(`user-${user.id}`).emit('tokens-awarded', {
          amount,
          reason,
          newTotal: user.total_tokens + amount
        });
      });

      res.json({
        message: `Successfully awarded ${amount} tokens to ${users.rows.length} users`,
        usersAffected: users.rows.length,
        totalTokensAwarded: amount * users.rows.length
      });
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }
  } catch (error) {
    console.error('Bulk award tokens error:', error);
    res.status(500).json({ error: 'Failed to award tokens' });
  }
});

// System Health Check
router.get('/health', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const checks = {
      database: { status: 'unknown', responseTime: null },
      blockchain: { status: 'unknown', responseTime: null },
      diskSpace: { status: 'unknown', usage: null },
      memory: { status: 'ok', usage: process.memoryUsage() }
    };

    // Database check
    const dbStart = Date.now();
    try {
      await db.query('SELECT 1');
      checks.database.status = 'ok';
      checks.database.responseTime = Date.now() - dbStart;
    } catch (error) {
      checks.database.status = 'error';
      checks.database.error = error.message;
    }

    // Blockchain check
    const blockchainStart = Date.now();
    try {
      const blockchainStats = await blockchain.getBlockchainStats();
      checks.blockchain.status = blockchainStats ? 'ok' : 'disconnected';
      checks.blockchain.responseTime = Date.now() - blockchainStart;
    } catch (error) {
      checks.blockchain.status = 'error';
      checks.blockchain.error = error.message;
    }

    // Overall health status
    const overallStatus = Object.values(checks).every(check => check.status === 'ok') ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      error: error.message 
    });
  }
});

// Export platform data (CSV/JSON)
router.get('/export/:type', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { type } = req.params; // users, tasks, activities
    const { format = 'json' } = req.query; // json, csv

    let data = [];
    let filename = '';

    switch (type) {
      case 'users':
        const users = await db.query(`
          SELECT id, username, full_name, email, department, role, 
                 total_tokens, current_streak, longest_streak, created_at
          FROM users
          ORDER BY created_at DESC
        `);
        data = users.rows;
        filename = `users_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'tasks':
        const tasks = await db.query(`
          SELECT t.id, t.title, t.priority, t.status, t.token_reward,
                 creator.username as created_by_username,
                 assignee.username as assigned_to_username,
                 t.created_at, t.completion_date
          FROM tasks t
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          ORDER BY t.created_at DESC
        `);
        data = tasks.rows;
        filename = `tasks_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'activities':
        const activities = await db.query(`
          SELECT ua.activity_type, ua.points_earned, ua.activity_date,
                 u.username, ua.blockchain_tx_hash
          FROM user_activities ua
          JOIN users u ON ua.user_id = u.id
          ORDER BY ua.activity_date DESC
          LIMIT 10000
        `);
        data = activities.rows;
        filename = `activities_export_${new Date().toISOString().split('T')[0]}`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    if (format === 'csv') {
      // Convert to CSV
      if (data.length === 0) {
        return res.status(404).json({ error: 'No data to export' });
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      res.json({
        exportType: type,
        exportDate: new Date().toISOString(),
        recordCount: data.length,
        data
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;