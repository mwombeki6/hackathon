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

    // Join league in database
    await db.query(`
      INSERT INTO user_leagues (user_id, league_id)
      VALUES ($1, $2)
    `, [userId, leagueId]);
    
    // Join league on blockchain if it exists there
    let blockchainTxHash = null;
    if (league.rows[0].blockchain_league_id) {
      try {
        blockchainTxHash = await blockchain.joinLeague(
          league.rows[0].blockchain_league_id,
          req.user.wallet_address
        );
      } catch (blockchainError) {
        console.error('Blockchain league join failed:', blockchainError);
      }
    }
    
    // Emit real-time update
    req.io?.emit('user-joined-league', {
      leagueId,
      userId,
      username: req.user.username,
      blockchainTxHash
    });

    res.json({ 
      message: 'Successfully joined league',
      blockchainTxHash
    });
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

// Update weekly scores (called by cron job or admin)
router.post('/:id/update-scores', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const leagueId = req.params.id;
    const { week, year } = req.body;
    
    const currentWeek = week || getCurrentWeekNumber();
    const currentYear = year || new Date().getFullYear();
    
    // Get all league members
    const members = await db.query(`
      SELECT ul.id as user_league_id, ul.user_id, u.username, u.wallet_address
      FROM user_leagues ul
      JOIN users u ON ul.user_id = u.id
      WHERE ul.league_id = ?
    `, [leagueId]);
    
    // Calculate scores for each member for the week
    for (const member of members.rows) {
      const weeklyStats = await calculateWeeklyScore(member.user_id, currentWeek, currentYear);
      
      // Insert or update weekly score
      await db.query(`
        INSERT OR REPLACE INTO weekly_scores 
        (user_league_id, week_number, year, points, tasks_completed, tokens_earned, peer_recognitions)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        member.user_league_id,
        currentWeek,
        currentYear,
        weeklyStats.totalPoints,
        weeklyStats.tasksCompleted,
        weeklyStats.tokensEarned,
        weeklyStats.peerRecognitions
      ]);
      
      // Update total points in user_leagues
      await db.query(`
        UPDATE user_leagues 
        SET total_points = (
          SELECT COALESCE(SUM(points), 0) 
          FROM weekly_scores 
          WHERE user_league_id = ?
        )
        WHERE id = ?
      `, [member.user_league_id, member.user_league_id]);
    }
    
    // Update rankings
    await updateLeagueRankings(leagueId);
    
    // Emit real-time update
    req.io?.emit('league-scores-updated', {
      leagueId,
      week: currentWeek,
      year: currentYear
    });
    
    res.json({ 
      message: 'Weekly scores updated successfully',
      week: currentWeek,
      year: currentYear
    });
  } catch (error) {
    console.error('Update scores error:', error);
    res.status(500).json({ error: 'Failed to update scores' });
  }
});

// End league season and distribute prizes
router.post('/:id/end-season', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const leagueId = req.params.id;
    
    // Get final standings
    const standings = await db.query(`
      SELECT 
        ul.user_id,
        u.username,
        u.wallet_address,
        ul.total_points,
        ROW_NUMBER() OVER (ORDER BY ul.total_points DESC) as final_rank
      FROM user_leagues ul
      JOIN users u ON ul.user_id = u.id
      WHERE ul.league_id = ?
      ORDER BY ul.total_points DESC
      LIMIT 10
    `, [leagueId]);
    
    const winners = standings.rows;
    
    // Distribute prizes (top 3)
    const prizes = [
      { rank: 1, tokens: 100, title: 'League Champion' },
      { rank: 2, tokens: 50, title: 'Runner-up' },
      { rank: 3, tokens: 25, title: 'Third Place' }
    ];
    
    for (const prize of prizes) {
      const winner = winners.find(w => w.final_rank === prize.rank);
      if (winner) {
        try {
          // Award tokens
          await blockchain.awardTokens(
            winner.wallet_address,
            prize.tokens * 1e18, // Convert to wei
            `League ${prize.title}`
          );
          
          // Update user tokens in database
          await db.query(
            'UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?',
            [prize.tokens, winner.user_id]
          );
        } catch (blockchainError) {
          console.error('Prize distribution failed:', blockchainError);
        }
      }
    }
    
    // Mark league as ended
    await db.query('UPDATE leagues SET is_active = false WHERE id = ?', [leagueId]);
    
    // Emit celebration event
    req.io?.emit('league-ended', {
      leagueId,
      winners: winners.slice(0, 3)
    });
    
    res.json({
      message: 'League season ended successfully',
      winners: winners.slice(0, 3)
    });
  } catch (error) {
    console.error('End season error:', error);
    res.status(500).json({ error: 'Failed to end season' });
  }
});

// Helper functions
async function calculateWeeklyScore(userId, week, year) {
  // Get week start and end dates
  const weekStart = getWeekStartDate(week, year);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  // Count tasks completed this week
  const tasksResult = await db.query(`
    SELECT COUNT(*) as count, COALESCE(SUM(token_reward), 0) as tokens
    FROM tasks 
    WHERE assigned_to = ? 
    AND status = 'completed' 
    AND completion_date >= ? 
    AND completion_date < ?
  `, [userId, weekStart, weekEnd]);
  
  const tasksCompleted = parseInt(tasksResult.rows[0].count) || 0;
  const tokensEarned = parseInt(tasksResult.rows[0].tokens) || 0;
  
  // Get peer recognitions (placeholder - would need to implement this feature)
  const peerRecognitions = 0;
  
  // Calculate total points (example scoring system)
  const totalPoints = (tasksCompleted * 10) + (tokensEarned * 0.1) + (peerRecognitions * 5);
  
  return {
    tasksCompleted,
    tokensEarned,
    peerRecognitions,
    totalPoints: Math.round(totalPoints)
  };
}

async function updateLeagueRankings(leagueId) {
  // Update rank in user_leagues based on total_points
  await db.query(`
    WITH ranked_users AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY total_points DESC) as new_rank
      FROM user_leagues 
      WHERE league_id = ?
    )
    UPDATE user_leagues 
    SET rank = ranked_users.new_rank
    FROM ranked_users 
    WHERE user_leagues.id = ranked_users.id
  `, [leagueId]);
}

function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

function getWeekStartDate(week, year) {
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - jan1.getDay();
  return new Date(year, 0, 1 + daysOffset);
}

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
