const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get active polls with options and user votes
router.get('/polls', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get polls with options
    const polls = await db.query(`
      SELECT p.*, u.username as creator_name,
             (SELECT COUNT(*) FROM votes pv WHERE pv.poll_id = p.id) as total_votes
      FROM polls p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.status = 'active'
      ORDER BY p.created_at DESC
    `);

    // Get options for each poll
    for (let poll of polls.rows) {
      const options = await db.query(`
        SELECT po.*, 
               (SELECT COUNT(*) FROM votes pv WHERE pv.poll_option_id = po.id) as vote_count
        FROM poll_options po
        WHERE po.poll_id = $1
        ORDER BY po.id
      `, [poll.id]);
      
      poll.options = options.rows;
      
      // Check if user has voted
      const userVote = await db.query(`
        SELECT v.poll_option_id FROM votes v WHERE v.poll_id = $1 AND v.user_id = $2
      `, [poll.id, userId]);
      
      poll.userVoted = userVote.rows.length > 0;
      poll.userVoteOptionId = userVote.rows.length > 0 ? userVote.rows[0].poll_option_id : null;
    }
    
    res.json(polls.rows);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// Create new poll
router.post('/polls', authenticateToken, requireRole(['admin', 'project_lead']), [
  body('title').isLength({ min: 1, max: 255 }).trim(),
  body('description').optional().isLength({ max: 1000 }),
  body('type').isIn(['employee_of_month', 'general', 'feedback']),
  body('options').isArray({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, type, options } = req.body;
    const userId = req.user.id;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // 7 days duration

    // Create poll
    const result = await db.query(`
      INSERT INTO polls (title, description, type, end_date, created_by, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *
    `, [title, description, type, endDate.toISOString(), userId]);

    const pollId = result.rows[0].id;

    // Create poll options
    for (const option of options) {
      if (option.trim()) {
        await db.query(`
          INSERT INTO poll_options (poll_id, option_text)
          VALUES ($1, $2)
        `, [pollId, option.trim()]);
      }
    }

    res.status(201).json({ id: pollId, message: 'Poll created successfully' });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Vote on poll
router.post('/polls/:id/vote', authenticateToken, [
  body('optionId').isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const pollId = req.params.id;
    const { optionId } = req.body;
    const userId = req.user.id;

    // Get poll
    const poll = await db.query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (poll.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if poll is active
    if (poll.rows[0].status !== 'active' || new Date() > new Date(poll.rows[0].end_date)) {
      return res.status(400).json({ error: 'Poll is not active' });
    }

    // Check if user already voted
    const existingVote = await db.query(`
      SELECT id FROM votes WHERE poll_id = $1 AND user_id = $2
    `, [pollId, userId]);
    
    if (existingVote.rows.length > 0) {
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    // Verify option belongs to poll
    const option = await db.query(`
      SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2
    `, [optionId, pollId]);
    
    if (option.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid option for this poll' });
    }

    // Cast vote
    await db.query(`
      INSERT INTO votes (poll_id, poll_option_id, user_id, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [pollId, optionId, userId]);

    // Award tokens for voting
    await db.query(`
      UPDATE users SET total_tokens = total_tokens + 5 WHERE id = $1
    `, [userId]);

    res.json({ message: 'Vote cast successfully', tokensEarned: 5 });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// Get poll results
router.get('/polls/:id/results', authenticateToken, async (req, res) => {
  try {
    const pollId = req.params.id;
    
    // Get poll with options and vote counts
    const poll = await db.query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (poll.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    const options = await db.query(`
      SELECT po.*, 
             COUNT(v.id) as vote_count,
             ROUND((COUNT(v.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM votes WHERE poll_id = $1), 0)), 2) as percentage
      FROM poll_options po
      LEFT JOIN votes v ON po.id = v.poll_option_id
      WHERE po.poll_id = $1
      GROUP BY po.id, po.option_text
      ORDER BY vote_count DESC
    `, [pollId]);
    
    const totalVotes = await db.query(`
      SELECT COUNT(*) as total FROM votes WHERE poll_id = $1
    `, [pollId]);
    
    res.json({
      poll: poll.rows[0],
      options: options.rows,
      totalVotes: totalVotes.rows[0].total
    });
  } catch (error) {
    console.error('Get poll results error:', error);
    res.status(500).json({ error: 'Failed to fetch poll results' });
  }
});

// Complete poll and award winner (admin only)
router.post('/polls/:id/complete', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const pollId = req.params.id;

    const poll = await db.query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (poll.rows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const pollData = poll.rows[0];

    if (!pollData.is_active) {
      return res.status(400).json({ error: 'Poll already completed' });
    }

    // Get winner (most votes)
    const winner = await db.query(`
      SELECT 
        pv.nominee_id,
        u.username,
        u.wallet_address,
        COUNT(pv.id) as vote_count
      FROM poll_votes pv
      JOIN users u ON pv.nominee_id = u.id
      WHERE pv.poll_id = $1
      GROUP BY pv.nominee_id, u.username, u.wallet_address
      ORDER BY vote_count DESC
      LIMIT 1
    `, [pollId]);

    try {
      await db.query('BEGIN TRANSACTION');

      // Update poll
      const winnerId = winner.rows.length > 0 ? winner.rows[0].nominee_id : null;
      await db.query(`
        UPDATE polls 
        SET is_active = false, winner_id = ?, completed_at = datetime('now')
        WHERE id = ?
      `, [winnerId, pollId]);

      // Award winner
      if (winnerId) {
        const rewardAmount = 500; // Employee of the month reward
        await db.query('UPDATE users SET total_tokens = total_tokens + ? WHERE id = ?', [rewardAmount, winnerId]);

        // Log activity
        await db.query(`
          INSERT INTO user_activities (user_id, activity_date, activity_type, points_earned)
          VALUES (?, date('now'), 'poll_winner', ?)
        `, [winnerId, rewardAmount]);
      }

      await db.query('COMMIT');
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }

    // Blockchain completion
    try {
      if (winnerId) {
        await blockchain.completePoll(pollId);
        await blockchain.awardTokens(winner.rows[0].wallet_address, 500, 'Employee of the Month');
      }
    } catch (blockchainError) {
      console.error('Blockchain poll completion failed:', blockchainError);
    }

    // Notify all users
    req.io.emit('poll-completed', {
      pollId,
      winner: winner.rows.length > 0 ? winner.rows[0] : null,
      totalVotes: winner.rows.length > 0 ? winner.rows[0].vote_count : 0
    });

    res.json({
      message: 'Poll completed successfully',
      winner: winner.rows.length > 0 ? winner.rows[0] : null
    });
  } catch (error) {
    console.error('Complete poll error:', error);
    res.status(500).json({ error: 'Failed to complete poll' });
  }
});

module.exports = router;
