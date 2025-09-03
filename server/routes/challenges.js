const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all challenges for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT 
        c.*,
        u1.username as challenger_name,
        u1.full_name as challenger_full_name,
        u2.username as challenged_name,
        u2.full_name as challenged_full_name
      FROM challenges c
      LEFT JOIN users u1 ON c.challenger_id = u1.id
      LEFT JOIN users u2 ON c.challenged_id = u2.id
      WHERE c.challenger_id = $1 OR c.challenged_id = $1
      ORDER BY c.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

// Create new challenge
router.post('/', authenticateToken, [
  body('challengedId').isInt({ min: 1 }),
  body('wager').isInt({ min: 1, max: 1000 }),
  body('description').isLength({ min: 1, max: 500 }).trim(),
  body('duration').optional().isInt({ min: 1, max: 30 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { challengedId, wager, description, duration = 7 } = req.body;
    const challengerId = req.user.id;

    // Check if challenging self
    if (challengerId === parseInt(challengedId)) {
      return res.status(400).json({ error: 'Cannot challenge yourself' });
    }

    // Check if challenged user exists
    const challengedUser = await db.query('SELECT id, total_tokens FROM users WHERE id = $1', [challengedId]);
    if (challengedUser.rows.length === 0) {
      return res.status(404).json({ error: 'Challenged user not found' });
    }

    // Check if challenger has enough tokens
    const challenger = await db.query('SELECT total_tokens FROM users WHERE id = $1', [challengerId]);
    if (challenger.rows[0].total_tokens < wager) {
      return res.status(400).json({ error: 'Insufficient tokens for wager' });
    }

    // Check if challenged user has enough tokens
    if (challengedUser.rows[0].total_tokens < wager) {
      return res.status(400).json({ error: 'Challenged user has insufficient tokens' });
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    // Create challenge
    const result = await db.query(`
      INSERT INTO challenges (
        challenger_id, challenged_id, wager, description, 
        end_date, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [challengerId, challengedId, wager, description, endDate]);

    const challenge = result.rows[0];

    // Create blockchain challenge
    try {
      const durationSeconds = duration * 24 * 60 * 60;
      const challengerUser = await db.query('SELECT wallet_address FROM users WHERE id = ?', [challengerId]);
      const challengedUserWallet = await db.query('SELECT wallet_address FROM users WHERE id = ?', [challengedId]);
      
      if (challengerUser.rows.length > 0 && challengedUserWallet.rows.length > 0) {
        const txHash = await blockchain.createH2HChallenge(
          challengerUser.rows[0].wallet_address,
          challengedUserWallet.rows[0].wallet_address,
          durationSeconds,
          wager
        );
        await db.query('UPDATE challenges SET blockchain_tx_hash = ? WHERE id = ?', [txHash, challenge.id]);
        console.log('Challenge created on blockchain:', txHash);
      }
    } catch (blockchainError) {
      console.error('Blockchain challenge creation failed:', blockchainError);
    }

    res.status(201).json(challenge);
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// Accept challenge
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const challengeId = req.params.id;
    const userId = req.user.id;

    // Get challenge details
    const challenge = await db.query(`
      SELECT * FROM challenges 
      WHERE id = $1 AND challenged_id = $2 AND status = 'pending'
    `, [challengeId, userId]);

    if (challenge.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found or not eligible to accept' });
    }

    const challengeData = challenge.rows[0];

    // Check if user has enough tokens
    const user = await db.query('SELECT total_tokens FROM users WHERE id = $1', [userId]);
    if (user.rows[0].total_tokens < challengeData.wager) {
      return res.status(400).json({ error: 'Insufficient tokens to accept challenge' });
    }

    // Update challenge status and deduct tokens from both users
    try {
      await db.query('BEGIN TRANSACTION');
      
      await db.query(`
        UPDATE challenges 
        SET status = 'active', accepted_at = datetime('now')
        WHERE id = ?
      `, [challengeId]);

      // Deduct wager from challenger
      await db.query(`
        UPDATE users 
        SET total_tokens = total_tokens - ?
        WHERE id = ?
      `, [challengeData.wager, challengeData.challenger_id]);

      // Deduct wager from challenged user
      await db.query(`
        UPDATE users 
        SET total_tokens = total_tokens - ?
        WHERE id = ?
      `, [challengeData.wager, challengeData.challenged_id]);

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    // Cancel and refund
    try {
      await db.query('BEGIN TRANSACTION');
      
      await db.query('UPDATE challenges SET status = ? WHERE id = ?', ['cancelled', challengeId]);
      await db.query('UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?', [challengeData.wager, challengeData.challenger_id]);

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    res.json({ message: 'Challenge accepted successfully' });
  } catch (error) {
    console.error('Accept challenge error:', error);
    res.status(500).json({ error: 'Failed to accept challenge' });
  }
});

// Decline challenge
router.post('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const challengeId = req.params.id;
    const userId = req.user.id;

    const result = await db.query(`
      UPDATE challenges 
      SET status = 'declined'
      WHERE id = $1 AND challenged_id = $2 AND status = 'pending'
      RETURNING *
    `, [challengeId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found or not eligible to decline' });
    }

    res.json({ message: 'Challenge declined successfully' });
  } catch (error) {
    console.error('Decline challenge error:', error);
    res.status(500).json({ error: 'Failed to decline challenge' });
  }
});

// Submit score for challenge
router.post('/:id/score', authenticateToken, [
  body('score').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const challengeId = req.params.id;
    const userId = req.user.id;
    const { score } = req.body;

    // Check if user is part of this challenge and it's active
    const challenge = await db.query(`
      SELECT * FROM challenges 
      WHERE id = $1 AND (challenger_id = $2 OR challenged_id = $2) AND status = 'active'
    `, [challengeId, userId]);

    if (challenge.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found or not active' });
    }

    const challengeData = challenge.rows[0];
    const isChallenger = challengeData.challenger_id === userId;

    // Update score
    const scoreField = isChallenger ? 'challenger_score' : 'challenged_score';
    await db.query(`
      UPDATE challenges 
      SET ${scoreField} = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [score, challengeId]);

    // Check if both scores are submitted to determine winner
    const updatedChallenge = await db.query('SELECT * FROM challenges WHERE id = ?', [challengeId]);
    const updated = updatedChallenge.rows[0];

    if (updated.challenger_score !== null && updated.challenged_score !== null) {
      // Determine winner and distribute tokens
      let winnerId, winnerScore, loserScore;
      
      if (updated.challenger_score > updated.challenged_score) {
        winnerId = updated.challenger_id;
        winnerScore = updated.challenger_score;
        loserScore = updated.challenged_score;
      } else if (updated.challenged_score > updated.challenger_score) {
        winnerId = updated.challenged_id;
        winnerScore = updated.challenged_score;
        loserScore = updated.challenger_score;
      } else {
        // Tie - return wagers to both users
        await db.query(`
          UPDATE users 
          SET total_tokens = total_tokens + ?
          WHERE id = ?
        `, [updated.wager, updated.challenger_id]);
        
        await db.query(`
          UPDATE users 
          SET total_tokens = total_tokens + ?
          WHERE id = ?
        `, [updated.wager, updated.challenged_id]);

        await db.query(`
          UPDATE challenges 
          SET status = 'completed', winner_id = NULL, completed_at = datetime('now')
          WHERE id = ?
        `, [challengeId]);

        return res.json({ message: 'Challenge completed - tie game, wagers returned' });
      }

      // Award winner double the wager
      await db.query(`
        UPDATE users 
        SET total_tokens = total_tokens + ?
        WHERE id = ?
      `, [updated.wager * 2, winnerId]);

      await db.query(`
        UPDATE challenges 
        SET status = 'completed', winner_id = ?, completed_at = datetime('now')
        WHERE id = ?
      `, [winnerId, challengeId]);

      res.json({ 
        message: 'Challenge completed', 
        winner_id: winnerId,
        winner_score: winnerScore,
        loser_score: loserScore
      });
    } else {
      res.json({ message: 'Score submitted successfully' });
    }
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Get all users for challenge selection
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT id, username, full_name, department, role, total_tokens
      FROM users 
      WHERE id != $1 AND role != 'admin'
      ORDER BY full_name
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
