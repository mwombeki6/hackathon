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

module.exports = router;
