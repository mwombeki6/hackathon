const express = require('express');
const db = require('../config/database');
const blockchain = require('../config/blockchain');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get current lottery round
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        lr.*,
        COUNT(lt.id) as total_tickets,
        COUNT(DISTINCT lt.user_id) as total_participants
      FROM lottery_rounds lr
      LEFT JOIN lottery_tickets lt ON lr.id = lt.lottery_round
      WHERE lr.is_active = true
      GROUP BY lr.id
      ORDER BY lr.created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active lottery round' });
    }

    const round = result.rows[0];

    // Get user's tickets for this round
    const userTickets = await db.query(`
      SELECT COUNT(*) as ticket_count
      FROM lottery_tickets
      WHERE user_id = $1 AND lottery_round = $2 AND is_used = false
    `, [req.user.id, round.id]);

    round.user_tickets = parseInt(userTickets.rows[0].ticket_count);

    res.json(round);
  } catch (error) {
    console.error('Get current lottery error:', error);
    res.status(500).json({ error: 'Failed to fetch current lottery' });
  }
});

// Get user's lottery tickets
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const { round } = req.query;
    
    let query = `
      SELECT lt.*, lr.round_name
      FROM lottery_tickets lt
      JOIN lottery_rounds lr ON lt.lottery_round = lr.id
      WHERE lt.user_id = $1
    `;
    const params = [req.user.id];

    if (round) {
      params.push(round);
      query += ` AND lt.lottery_round = $${params.length}`;
    }

    query += ' ORDER BY lt.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get lottery tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get lottery history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        lr.*,
        winner.username as winner_name,
        winner.full_name as winner_full_name,
        COUNT(lt.id) as total_tickets
      FROM lottery_rounds lr
      LEFT JOIN users winner ON lr.winner_id = winner.id
      LEFT JOIN lottery_tickets lt ON lr.id = lt.lottery_round
      WHERE lr.is_active = false
      GROUP BY lr.id, winner.username, winner.full_name
      ORDER BY lr.end_date DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get lottery history error:', error);
    res.status(500).json({ error: 'Failed to fetch lottery history' });
  }
});

// Manual ticket issuance (admin only)
router.post('/issue-ticket', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId, reason } = req.body;

    // Get current round
    const currentRound = await db.query(`
      SELECT id FROM lottery_rounds WHERE is_active = true ORDER BY created_at DESC LIMIT 1
    `);

    if (currentRound.rows.length === 0) {
      return res.status(400).json({ error: 'No active lottery round' });
    }

    const roundId = currentRound.rows[0].id;
    const ticketNumber = `T${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

    // Issue ticket
    await db.query(`
      INSERT INTO lottery_tickets (user_id, ticket_number, lottery_round, earned_from)
      VALUES ($1, $2, $3, $4)
    `, [userId, ticketNumber, roundId, reason]);

    // Issue on blockchain
    try {
      const user = await db.query('SELECT wallet_address FROM users WHERE id = $1', [userId]);
      if (user.rows.length > 0) {
        await blockchain.issueTicket(user.rows[0].wallet_address, reason);
      }
    } catch (blockchainError) {
      console.error('Blockchain ticket issuance failed:', blockchainError);
    }

    // Notify user
    req.io.to(`user-${userId}`).emit('lottery-ticket', {
      ticketNumber,
      reason
    });

    res.json({ message: 'Ticket issued successfully', ticketNumber });
  } catch (error) {
    console.error('Issue ticket error:', error);
    res.status(500).json({ error: 'Failed to issue ticket' });
  }
});

// Draw lottery (admin only)
router.post('/draw', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get current active round
    const currentRound = await db.query(`
      SELECT * FROM lottery_rounds WHERE is_active = true ORDER BY created_at DESC LIMIT 1
    `);

    if (currentRound.rows.length === 0) {
      return res.status(400).json({ error: 'No active lottery round' });
    }

    const round = currentRound.rows[0];

    // Check if round has ended
    if (new Date() < new Date(round.end_date)) {
      return res.status(400).json({ error: 'Round has not ended yet' });
    }

    // Get all tickets for this round
    const tickets = await db.query(`
      SELECT lt.*, u.username, u.wallet_address
      FROM lottery_tickets lt
      JOIN users u ON lt.user_id = u.id
      WHERE lt.lottery_round = $1 AND lt.is_used = false
    `, [round.id]);

    if (tickets.rows.length === 0) {
      return res.status(400).json({ error: 'No tickets in this round' });
    }

    // Generate random winner
    const randomIndex = Math.floor(Math.random() * tickets.rows.length);
    const winningTicket = tickets.rows[randomIndex];

    try {
      await db.query('BEGIN TRANSACTION');

      // Update round with winner
      await db.query(`
        UPDATE lottery_rounds 
        SET winner_id = ?, is_active = false, actual_end_date = datetime('now')
        WHERE id = ?
      `, [winningTicket.user_id, round.id]);

      // Mark winning ticket as used
      await db.query('UPDATE lottery_tickets SET is_used = true WHERE id = ?', [winningTicket.id]);

      // Award bonus tokens to winner
      await db.query('UPDATE users SET total_tokens = total_tokens + 100 WHERE id = ?', [winningTicket.user_id]);

      // Create new round
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 7);

      await db.query(`
        INSERT INTO lottery_rounds (round_name, start_date, end_date, perk_description)
        VALUES (?, datetime('now'), ?, 'Mystery Perk')
      `, [`Round ${round.id + 1}`, newEndDate.toISOString()]);

      await db.query('COMMIT');
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }

    // Blockchain lottery draw
    try {
      await blockchain.drawLottery();
      await blockchain.awardTokens(winningTicket.wallet_address, 100, 'Lottery winner');
    } catch (blockchainError) {
      console.error('Blockchain lottery draw failed:', blockchainError);
    }

    // Notify all users
    req.io.emit('lottery-drawn', {
      winner: winningTicket.username,
      ticketNumber: winningTicket.ticket_number,
      roundId: round.id
    });

    res.json({
      winner: {
        id: winningTicket.user_id,
        username: winningTicket.username,
        ticketNumber: winningTicket.ticket_number
      },
      roundId: round.id,
      totalTickets: tickets.rows.length
    });
  } catch (error) {
    console.error('Draw lottery error:', error);
    res.status(500).json({ error: 'Failed to draw lottery' });
  }
});

module.exports = router;
