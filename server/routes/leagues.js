const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all leagues
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, 
             u.username as creator_name,
             COUNT(ul.user_id) as member_count
      FROM leagues l
      LEFT JOIN users u ON l.created_by = u.id
      LEFT JOIN user_leagues ul ON l.id = ul.league_id
      WHERE l.is_active = true
      GROUP BY l.id, u.username
      ORDER BY l.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get leagues error:', error);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// Create new league
router.post('/', authenticateToken, requireRole(['project_lead', 'admin']), [
  body('name').isLength({ min: 1, max: 100 }).trim(),
  body('description').optional().isLength({ max: 500 }),
  body('tier').optional().isInt({ min: 1, max: 5 }),
  body('maxMembers').optional().isInt({ min: 2, max: 100 }),
  body('seasonDuration').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, tier = 1, maxMembers = 50, seasonDuration = 90 } = req.body;
    
    const seasonStart = new Date();
    const seasonEnd = new Date();
    seasonEnd.setDate(seasonEnd.getDate() + seasonDuration);

    // Create league in database
    const result = await db.query(`
      INSERT INTO leagues (name, description, tier, season_start, season_end, max_members, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, description, tier, seasonStart, seasonEnd, maxMembers, req.user.id]);

    const league = result.rows[0];

    // Create league on blockchain
    try {
      const durationSeconds = seasonDuration * 24 * 60 * 60;
      const txHash = await blockchain.createLeague(name, tier, durationSeconds, maxMembers);
      console.log('League created on blockchain:', txHash);
    } catch (blockchainError) {
      console.error('Blockchain league creation failed:', blockchainError);
    }

    res.status(201).json(league);
  } catch (error) {
    console.error('Create league error:', error);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// Join league
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const leagueId = req.params.id;
    const userId = req.user.id;

    // Check if league exists and is active
    const league = await db.query('SELECT * FROM leagues WHERE id = $1 AND is_active = true', [leagueId]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: 'League not found or inactive' });
    }

    // Check if user already in league
    const existing = await db.query('SELECT id FROM user_leagues WHERE user_id = $1 AND league_id = $2', [userId, leagueId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already in this league' });
    }

    // Check member count
    const memberCount = await db.query('SELECT COUNT(*) FROM user_leagues WHERE league_id = $1', [leagueId]);
    if (parseInt(memberCount.rows[0].count) >= league.rows[0].max_members) {
      return res.status(400).json({ error: 'League is full' });
    }

    // Join league
    await db.query(`
      INSERT INTO user_leagues (user_id, league_id)
      VALUES ($1, $2)
    `, [userId, leagueId]);

    res.json({ message: 'Successfully joined league' });
  } catch (error) {
    console.error('Join league error:', error);
    res.status(500).json({ error: 'Failed to join league' });
  }
});

// Get league standings
router.get('/:id/standings', authenticateToken, async (req, res) => {
  try {
    const leagueId = req.params.id;

    const result = await db.query(`
      SELECT 
        ul.*,
        u.username,
        u.full_name,
        u.department,
        u.current_streak,
        u.streak_level,
        ROW_NUMBER() OVER (ORDER BY ul.total_points DESC) as current_rank
      FROM user_leagues ul
      JOIN users u ON ul.user_id = u.id
      WHERE ul.league_id = $1
      ORDER BY ul.total_points DESC
    `, [leagueId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get standings error:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// Get weekly scores for league
router.get('/:id/weekly-scores', authenticateToken, async (req, res) => {
  try {
    const leagueId = req.params.id;
    const { week, year } = req.query;

    let query = `
      SELECT 
        ws.*,
        u.username,
        u.full_name
      FROM weekly_scores ws
      JOIN user_leagues ul ON ws.user_league_id = ul.id
      JOIN users u ON ul.user_id = u.id
      WHERE ul.league_id = $1
    `;
    const params = [leagueId];

    if (week && year) {
      params.push(week, year);
      query += ` AND ws.week_number = $2 AND ws.year = $3`;
    }

    query += ' ORDER BY ws.points DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get weekly scores error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly scores' });
  }
});

// Leave league
router.delete('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const leagueId = req.params.id;
    const userId = req.user.id;

    const result = await db.query(`
      DELETE FROM user_leagues 
      WHERE user_id = $1 AND league_id = $2
      RETURNING *
    `, [userId, leagueId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not a member of this league' });
    }

    res.json({ message: 'Successfully left league' });
  } catch (error) {
    console.error('Leave league error:', error);
    res.status(500).json({ error: 'Failed to leave league' });
  }
});

module.exports = router;
