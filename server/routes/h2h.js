const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's H2H matches
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT h.*,
             challenger.username as challenger_name,
             challenger.full_name as challenger_full_name,
             opponent.username as opponent_name,
             opponent.full_name as opponent_full_name,
             winner.username as winner_name
      FROM head_to_head h
      JOIN users challenger ON h.challenger_id = challenger.id
      JOIN users opponent ON h.opponent_id = opponent.id
      LEFT JOIN users winner ON h.winner_id = winner.id
      WHERE (h.challenger_id = $1 OR h.opponent_id = $1)
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      query += ` AND h.status = $${params.length}`;
    }

    query += ' ORDER BY h.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get H2H matches error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Create H2H challenge
router.post('/challenge', authenticateToken, [
  body('opponentId').isInt(),
  body('challengeType').isIn(['weekly', 'monthly', 'custom']),
  body('duration').optional().isInt({ min: 1, max: 30 }),
  body('stakeTokens').optional().isInt({ min: 5, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { opponentId, challengeType, duration = 7, stakeTokens = 10 } = req.body;
    const challengerId = req.user.id;

    if (opponentId === challengerId) {
      return res.status(400).json({ error: 'Cannot challenge yourself' });
    }

    // Check if opponent exists
    const opponent = await db.query('SELECT * FROM users WHERE id = $1', [opponentId]);
    if (opponent.rows.length === 0) {
      return res.status(404).json({ error: 'Opponent not found' });
    }

    // Check if challenger has enough tokens
    if (req.user.total_tokens < stakeTokens) {
      return res.status(400).json({ error: 'Insufficient tokens for stake' });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    // Create challenge
    const result = await db.query(`
      INSERT INTO head_to_head (challenger_id, opponent_id, challenge_type, start_date, end_date, stake_tokens)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [challengerId, opponentId, challengeType, startDate, endDate, stakeTokens]);

    const challenge = result.rows[0];

    // Deduct stake from challenger
    await db.query('UPDATE users SET total_tokens = total_tokens - $1 WHERE id = $2', [stakeTokens, challengerId]);

    // Create blockchain challenge
    try {
      const durationSeconds = duration * 24 * 60 * 60;
      const txHash = await blockchain.createH2HChallenge(
        req.user.wallet_address,
        opponent.rows[0].wallet_address,
        durationSeconds,
        stakeTokens
      );
      
      await db.query('UPDATE head_to_head SET blockchain_tx_hash = $1 WHERE id = $2', [txHash, challenge.id]);
    } catch (blockchainError) {
      console.error('Blockchain H2H creation failed:', blockchainError);
    }

    // Notify opponent
    req.io.to(`user-${opponentId}`).emit('h2h-challenge', {
      challenge,
      challenger: req.user.username
    });

    res.status(201).json(challenge);
  } catch (error) {
    console.error('Create H2H challenge error:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// Accept H2H challenge
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const challengeId = req.params.id;
    const userId = req.user.id;

    // Get challenge
    const challenge = await db.query('SELECT * FROM head_to_head WHERE id = $1', [challengeId]);
    if (challenge.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const match = challenge.rows[0];

    if (match.opponent_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this challenge' });
    }

    if (match.status !== 'pending') {
      return res.status(400).json({ error: 'Challenge cannot be accepted' });
    }

    // Check if opponent has enough tokens
    if (req.user.total_tokens < match.stake_tokens) {
      return res.status(400).json({ error: 'Insufficient tokens for stake' });
    }

    // Accept challenge
    try {
      await db.query('BEGIN TRANSACTION');
      
      await db.query(`
        UPDATE head_to_head 
        SET status = 'active', start_date = date('now') 
        WHERE id = ?
      `, [challengeId]);

      // Deduct stake from opponent
      await db.query('UPDATE users SET total_tokens = total_tokens - ? WHERE id = ?', [match.stake_tokens, userId]);

      await db.query('COMMIT');
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }

    // Notify challenger
    req.io.to(`user-${match.challenger_id}`).emit('h2h-accepted', {
      challengeId,
      opponent: req.user.username
    });

    res.json({ message: 'Challenge accepted successfully' });
  } catch (error) {
    console.error('Accept H2H challenge error:', error);
    res.status(500).json({ error: 'Failed to accept challenge' });
  }
});

// Get H2H match details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const challengeId = req.params.id;

    const result = await db.query(`
      SELECT h.*,
             challenger.username as challenger_name,
             challenger.full_name as challenger_full_name,
             opponent.username as opponent_name,
             opponent.full_name as opponent_full_name,
             winner.username as winner_name
      FROM head_to_head h
      JOIN users challenger ON h.challenger_id = challenger.id
      JOIN users opponent ON h.opponent_id = opponent.id
      LEFT JOIN users winner ON h.winner_id = winner.id
      WHERE h.id = $1
    `, [challengeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const match = result.rows[0];

    // Check permissions
    if (match.challenger_id !== req.user.id && match.opponent_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this challenge' });
    }

    // Get performance data for active matches
    if (match.status === 'active') {
      const performanceData = await db.query(`
        SELECT 
          user_id,
          COUNT(CASE WHEN activity_type = 'task_completed' THEN 1 END) as tasks_completed,
          SUM(points_earned) as total_points
        FROM user_activities
        WHERE user_id IN ($1, $2) 
          AND activity_date BETWEEN $3 AND $4
        GROUP BY user_id
      `, [match.challenger_id, match.opponent_id, match.start_date, match.end_date]);

      match.performance_data = performanceData.rows;
    }

    res.json(match);
  } catch (error) {
    console.error('Get H2H match error:', error);
    res.status(500).json({ error: 'Failed to fetch match details' });
  }
});

// Cancel H2H challenge (only pending challenges)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const challengeId = req.params.id;

    const challenge = await db.query('SELECT * FROM head_to_head WHERE id = $1', [challengeId]);
    if (challenge.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const match = challenge.rows[0];

    if (match.challenger_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to cancel this challenge' });
    }

    if (match.status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending challenges' });
    }

    // Cancel and refund
    try {
      await db.query('BEGIN TRANSACTION');
      
      await db.query('UPDATE head_to_head SET status = ? WHERE id = ?', ['cancelled', challengeId]);
      await db.query('UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?', [match.stake_tokens, match.challenger_id]);

      await db.query('COMMIT');
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }

    // Notify opponent
    req.io.to(`user-${match.opponent_id}`).emit('h2h-cancelled', {
      challengeId,
      challenger: req.user.username
    });

    res.json({ message: 'Challenge cancelled successfully' });
  } catch (error) {
    console.error('Cancel H2H challenge error:', error);
    res.status(500).json({ error: 'Failed to cancel challenge' });
  }
});

module.exports = router;
