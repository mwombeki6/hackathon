const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/streaks/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

const router = express.Router();

// Get user dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user stats
    const userStats = await db.query(`
      SELECT 
        u.*,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status IN ('pending', 'in_progress') THEN 1 END) as active_tasks,
        COUNT(CASE WHEN t.due_date < CURRENT_TIMESTAMP AND t.status != 'completed' THEN 1 END) as overdue_tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    // Get recent activities
    const activities = await db.query(`
      SELECT * FROM user_activities 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);

    // Get lottery tickets for current round
    const tickets = await db.query(`
      SELECT COUNT(*) as ticket_count
      FROM lottery_tickets 
      WHERE user_id = $1 AND is_used = false
    `, [userId]);

    // Get active leagues
    const leagues = await db.query(`
      SELECT l.*, ul.total_points, ul.rank
      FROM leagues l
      JOIN user_leagues ul ON l.id = ul.league_id
      WHERE ul.user_id = $1 AND l.is_active = true
    `, [userId]);

    // Get active H2H matches
    const h2hMatches = await db.query(`
      SELECT h.*, 
             challenger.username as challenger_name,
             opponent.username as opponent_name
      FROM head_to_head h
      JOIN users challenger ON h.challenger_id = challenger.id
      JOIN users opponent ON h.opponent_id = opponent.id
      WHERE (h.challenger_id = $1 OR h.opponent_id = $1) 
        AND h.status IN ('pending', 'active')
    `, [userId]);

    res.json({
      user: userStats.rows[0],
      recentActivities: activities.rows,
      lotteryTickets: parseInt(tickets.rows[0].ticket_count),
      activeLeagues: leagues.rows,
      activeH2HMatches: h2hMatches.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { type = 'overall' } = req.query;
    
    let orderBy = 'u.total_tokens DESC';
    if (type === 'streaks') orderBy = 'u.current_streak DESC';
    if (type === 'tasks') orderBy = 'completed_tasks DESC';
    
    const result = await db.query(`
      SELECT 
        u.id, u.username, u.full_name, u.department, u.role,
        u.total_tokens, u.current_streak,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE u.role != 'admin'
      GROUP BY u.id, u.username, u.full_name, u.department, u.role, u.total_tokens, u.current_streak
      ORDER BY ${orderBy}
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user profile by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const result = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.department,
        u.role,
        u.total_tokens,
        u.current_streak,
        u.longest_streak,
        u.streak_level,
        u.badges,
        u.created_at,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status IN ('pending', 'in_progress') THEN 1 END) as active_tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Award peer recognition tokens
router.post('/:id/recognize', authenticateToken, async (req, res) => {
  try {
    const recipientId = req.params.id;
    const { amount = 5, message } = req.body;

    if (recipientId == req.user.id) {
      return res.status(400).json({ error: 'Cannot recognize yourself' });
    }

    // Check if giver has enough tokens
    if (req.user.total_tokens < amount) {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }

    // Get recipient
    const recipient = await db.query('SELECT * FROM users WHERE id = $1', [recipientId]);
    if (recipient.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transfer tokens
    try {
      await db.query('BEGIN TRANSACTION');
      
      // Deduct from giver
      await db.query('UPDATE users SET total_tokens = total_tokens - ? WHERE id = ?', [amount, req.user.id]);
      
      // Add to recipient
      await db.query('UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?', [amount, recipientId]);

      // Log activities
      await db.query(`
        INSERT INTO user_activities (user_id, activity_date, activity_type, points_earned)
        VALUES (?, date('now'), 'peer_recognition_given', ?)
      `, [req.user.id, -amount]);

      await db.query(`
        INSERT INTO user_activities (user_id, activity_date, activity_type, points_earned)
        VALUES (?, date('now'), 'peer_recognition_received', ?)
      `, [recipientId, amount]);

      await db.query('COMMIT');
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }

    // Blockchain transfer
    try {
      await blockchain.spendTokens(req.user.wallet_address, amount, 'Peer recognition');
      await blockchain.awardTokens(recipient.rows[0].wallet_address, amount, 'Peer recognition received');
    } catch (blockchainError) {
      console.error('Blockchain recognition transfer failed:', blockchainError);
    }

    // Emit notification
    req.io.to(`user-${recipientId}`).emit('peer-recognition', {
      from: req.user.username,
      amount,
      message
    });

    res.json({ message: 'Recognition sent successfully' });
  } catch (error) {
    console.error('Peer recognition error:', error);
    res.status(500).json({ error: 'Failed to send recognition' });
  }
});

// Get all users (for admin/leads)
router.get('/', authenticateToken, requireRole(['project_lead', 'admin']), async (req, res) => {
  try {
    const { department, role } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.department,
        u.role,
        u.total_tokens,
        u.current_streak,
        u.streak_level,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE 1=1
    `;
    const params = [];

    if (department) {
      params.push(department);
      query += ` AND u.department = $${params.length}`;
    }

    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }

    query += ' GROUP BY u.id ORDER BY u.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch('/:id/role', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['team_member', 'project_lead', 'reviewer', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Submit daily streak activity
router.post('/streak', authenticateToken, upload.single('file'), [
  body('activity').isLength({ min: 1, max: 100 }).trim(),
  body('description').isLength({ min: 1, max: 500 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { activity, description } = req.body;
    const userId = req.user.id;
    const filePath = req.file ? req.file.path : null;

    // Check if user already logged activity today
    const today = new Date().toISOString().split('T')[0];
    const existingStreak = await db.query(`
      SELECT id FROM streaks 
      WHERE user_id = $1 AND DATE(created_at) = $2
    `, [userId, today]);
    
    if (existingStreak.rows.length > 0) {
      return res.status(400).json({ error: 'Activity already logged for today' });
    }
    
    // Insert new streak activity
    await db.query(`
      INSERT INTO streaks (user_id, activity_type, description, file_path, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [userId, activity, description, filePath]);
    
    // Update user's current streak and tokens
    await db.query(`
      UPDATE users 
      SET current_streak = current_streak + 1, 
          total_tokens = total_tokens + 10
      WHERE id = $1
    `, [userId]);
    
    res.json({ message: 'Daily activity logged successfully', tokensEarned: 10 });
  } catch (error) {
    console.error('Error logging streak:', error);
    res.status(500).json({ error: 'Failed to log streak activity' });
  }
});

// Gift tokens to peer
router.post('/gift-tokens', authenticateToken, [
  body('recipientId').isInt({ min: 1 }),
  body('amount').isInt({ min: 1, max: 1000 }),
  body('message').optional().isLength({ max: 200 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipientId, amount, message } = req.body;
    const senderId = req.user.id;
    
    if (senderId === parseInt(recipientId)) {
      return res.status(400).json({ error: 'Cannot gift tokens to yourself' });
    }
    
    // Check sender has enough tokens
    const sender = await db.query('SELECT total_tokens FROM users WHERE id = $1', [senderId]);
    if (sender.rows.length === 0 || sender.rows[0].total_tokens < amount) {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    // Check recipient exists
    const recipient = await db.query('SELECT id FROM users WHERE id = $1', [recipientId]);
    if (recipient.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Transfer tokens
    try {
      await db.query('BEGIN TRANSACTION');
      await db.query('UPDATE users SET total_tokens = total_tokens - ? WHERE id = ?', [amount, senderId]);
      await db.query('UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?', [amount, recipientId]);
      await db.query('COMMIT');
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }
    
    res.json({ message: 'Tokens gifted successfully' });
  } catch (error) {
    console.error('Error gifting tokens:', error);
    res.status(500).json({ error: 'Failed to gift tokens' });
  }
});

// Get user activities (admin only)
router.get('/activities', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, u.username, u.full_name, u.department, u.role,
        u.total_tokens, u.current_streak,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT s.id) as total_streaks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      LEFT JOIN streaks s ON u.id = s.user_id
      WHERE u.role != 'admin'
      GROUP BY u.id, u.username, u.full_name, u.department, u.role, u.total_tokens, u.current_streak
      ORDER BY u.total_tokens DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ error: 'Failed to fetch user activities' });
  }
});

// Get comprehensive user dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user basic info with current tokens
    const userInfo = await db.query(`
      SELECT id, username, full_name, email, department, total_tokens, 
             current_streak, longest_streak, streak_level, badges, wallet_address,
             created_at
      FROM users WHERE id = ?
    `, [userId]);
    
    // Get task statistics
    const taskStats = await db.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN token_reward ELSE 0 END), 0) as tokens_earned
      FROM tasks 
      WHERE assigned_to = ?
    `, [userId]);
    
    // Get recent activity (last 30 days)
    const recentActivity = await db.query(`
      SELECT activity_type, points_earned, activity_date, blockchain_tx_hash
      FROM user_activities 
      WHERE user_id = ? 
      AND activity_date >= date('now', '-30 days')
      ORDER BY activity_date DESC 
      LIMIT 10
    `, [userId]);
    
    // Get league participation
    const leagueStats = await db.query(`
      SELECT 
        l.name as league_name,
        ul.total_points,
        ul.rank,
        l.max_members
      FROM user_leagues ul
      JOIN leagues l ON ul.league_id = l.id
      WHERE ul.user_id = ? AND l.is_active = true
    `, [userId]);
    
    // Get H2H challenge stats
    const h2hStats = await db.query(`
      SELECT 
        COUNT(*) as total_challenges,
        COUNT(CASE WHEN winner_id = ? THEN 1 END) as wins,
        COUNT(CASE WHEN (challenger_id = ? OR opponent_id = ?) AND winner_id != ? AND winner_id IS NOT NULL THEN 1 END) as losses,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_challenges
      FROM head_to_head 
      WHERE challenger_id = ? OR opponent_id = ?
    `, [userId, userId, userId, userId, userId, userId]);
    
    // Get lottery tickets and wins
    const lotteryStats = await db.query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN is_used = true THEN 1 END) as used_tickets
      FROM lottery_tickets 
      WHERE user_id = ?
    `, [userId]);
    
    const lotteryWins = await db.query(`
      SELECT COUNT(*) as lottery_wins
      FROM lottery_rounds 
      WHERE winner_id = ?
    `, [userId]);
    
    // Get blockchain token balance if available
    let blockchainBalance = 0;
    try {
      if (userInfo.rows[0]?.wallet_address) {
        blockchainBalance = await blockchain.getUserTokenBalance(userInfo.rows[0].wallet_address);
      }
    } catch (blockchainError) {
      console.error('Failed to get blockchain balance:', blockchainError);
    }
    
    // Get weekly performance (current week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weeklyPerformance = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as tasks_this_week,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN token_reward ELSE 0 END), 0) as tokens_this_week
      FROM tasks 
      WHERE assigned_to = ? 
      AND completion_date >= ? 
      AND completion_date < ?
    `, [userId, weekStart.toISOString(), weekEnd.toISOString()]);
    
    const dashboardData = {
      user: userInfo.rows[0],
      statistics: {
        tasks: taskStats.rows[0],
        h2h: h2hStats.rows[0],
        lottery: {
          ...lotteryStats.rows[0],
          wins: lotteryWins.rows[0].lottery_wins
        },
        weeklyPerformance: weeklyPerformance.rows[0],
        blockchainBalance
      },
      leagues: leagueStats.rows,
      recentActivity: recentActivity.rows,
      achievements: {
        streakLevel: userInfo.rows[0].streak_level,
        longestStreak: userInfo.rows[0].longest_streak,
        badges: JSON.parse(userInfo.rows[0].badges || '[]')
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get user leaderboard position and nearby users
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { type = 'tokens' } = req.query; // tokens, streak, tasks
    
    let orderBy = 'total_tokens';
    switch (type) {
      case 'streak':
        orderBy = 'current_streak';
        break;
      case 'tasks':
        orderBy = 'tasks_completed';
        break;
      default:
        orderBy = 'total_tokens';
    }
    
    // Get user's position
    const userPosition = await db.query(`
      SELECT 
        user_rank
      FROM (
        SELECT 
          id,
          ROW_NUMBER() OVER (ORDER BY ${orderBy} DESC) as user_rank
        FROM users
      ) ranked
      WHERE id = ?
    `, [req.user.id]);
    
    // Get top 10 users
    const topUsers = await db.query(`
      SELECT 
        u.id, u.username, u.full_name, u.department,
        u.total_tokens, u.current_streak, u.longest_streak, u.streak_level,
        COALESCE(task_counts.completed, 0) as tasks_completed,
        ROW_NUMBER() OVER (ORDER BY u.${orderBy} DESC) as rank
      FROM users u
      LEFT JOIN (
        SELECT 
          assigned_to,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        FROM tasks
        GROUP BY assigned_to
      ) task_counts ON u.id = task_counts.assigned_to
      ORDER BY u.${orderBy} DESC
      LIMIT 10
    `);
    
    // Get users around current user's position
    const currentRank = userPosition.rows[0]?.user_rank || 1;
    const nearbyUsers = await db.query(`
      SELECT 
        u.id, u.username, u.full_name, u.department,
        u.total_tokens, u.current_streak, u.longest_streak, u.streak_level,
        COALESCE(task_counts.completed, 0) as tasks_completed,
        user_rank as rank
      FROM (
        SELECT 
          id, username, full_name, department, total_tokens, current_streak, 
          longest_streak, streak_level,
          ROW_NUMBER() OVER (ORDER BY ${orderBy} DESC) as user_rank
        FROM users
      ) u
      LEFT JOIN (
        SELECT 
          assigned_to,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        FROM tasks
        GROUP BY assigned_to
      ) task_counts ON u.id = task_counts.assigned_to
      WHERE user_rank BETWEEN ? AND ?
      ORDER BY user_rank
    `, [Math.max(1, currentRank - 2), currentRank + 2]);
    
    res.json({
      leaderboardType: type,
      userPosition: currentRank,
      topUsers: topUsers.rows,
      nearbyUsers: nearbyUsers.rows
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user achievements and badges
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current user stats
    const userStats = await db.query(`
      SELECT 
        u.*,
        COALESCE(task_stats.total_tasks, 0) as total_tasks,
        COALESCE(task_stats.completed_tasks, 0) as completed_tasks,
        COALESCE(h2h_stats.total_challenges, 0) as total_challenges,
        COALESCE(h2h_stats.wins, 0) as h2h_wins,
        COALESCE(lottery_stats.lottery_wins, 0) as lottery_wins
      FROM users u
      LEFT JOIN (
        SELECT 
          assigned_to,
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
        FROM tasks
        GROUP BY assigned_to
      ) task_stats ON u.id = task_stats.assigned_to
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as total_challenges,
          COUNT(CASE WHEN winner_id = user_id THEN 1 END) as wins
        FROM (
          SELECT challenger_id as user_id, winner_id FROM head_to_head
          UNION ALL
          SELECT opponent_id as user_id, winner_id FROM head_to_head
        ) all_challenges
        GROUP BY user_id
      ) h2h_stats ON u.id = h2h_stats.user_id
      LEFT JOIN (
        SELECT winner_id, COUNT(*) as lottery_wins
        FROM lottery_rounds
        WHERE winner_id IS NOT NULL
        GROUP BY winner_id
      ) lottery_stats ON u.id = lottery_stats.winner_id
      WHERE u.id = ?
    `, [userId]);
    
    const user = userStats.rows[0];
    const currentBadges = JSON.parse(user.badges || '[]');
    const newBadges = [];
    
    // Define achievement thresholds and check for new badges
    const achievements = [
      {
        id: 'first_task',
        name: 'First Steps',
        description: 'Complete your first task',
        condition: user.completed_tasks >= 1,
        icon: '🎯'
      },
      {
        id: 'task_master_10',
        name: 'Task Master',
        description: 'Complete 10 tasks',
        condition: user.completed_tasks >= 10,
        icon: '⭐'
      },
      {
        id: 'task_champion_50',
        name: 'Task Champion',
        description: 'Complete 50 tasks',
        condition: user.completed_tasks >= 50,
        icon: '🏆'
      },
      {
        id: 'streak_warrior_7',
        name: 'Streak Warrior',
        description: 'Maintain a 7-day streak',
        condition: user.longest_streak >= 7,
        icon: '🔥'
      },
      {
        id: 'streak_legend_30',
        name: 'Streak Legend',
        description: 'Maintain a 30-day streak',
        condition: user.longest_streak >= 30,
        icon: '💎'
      },
      {
        id: 'token_collector_1000',
        name: 'Token Collector',
        description: 'Earn 1000 BET tokens',
        condition: user.total_tokens >= 1000,
        icon: '💰'
      },
      {
        id: 'h2h_winner',
        name: 'Head-to-Head Champion',
        description: 'Win your first H2H challenge',
        condition: user.h2h_wins >= 1,
        icon: '⚔️'
      },
      {
        id: 'lottery_winner',
        name: 'Lucky Winner',
        description: 'Win a lottery draw',
        condition: user.lottery_wins >= 1,
        icon: '🎰'
      }
    ];
    
    // Check for new achievements
    for (const achievement of achievements) {
      if (achievement.condition && !currentBadges.some(badge => badge.id === achievement.id)) {
        newBadges.push(achievement);
        currentBadges.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          earnedAt: new Date().toISOString()
        });
      }
    }
    
    // Update user badges if there are new ones
    if (newBadges.length > 0) {
      await db.query(
        'UPDATE users SET badges = ? WHERE id = ?',
        [JSON.stringify(currentBadges), userId]
      );
      
      // Emit achievement notifications
      req.io?.to(`user-${userId}`).emit('new-achievements', newBadges);
    }
    
    res.json({
      allAchievements: achievements,
      earnedBadges: currentBadges,
      newBadges,
      progress: {
        tasksCompleted: user.completed_tasks,
        longestStreak: user.longest_streak,
        totalTokens: user.total_tokens,
        h2hWins: user.h2h_wins || 0,
        lotteryWins: user.lottery_wins || 0
      }
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

module.exports = router;
