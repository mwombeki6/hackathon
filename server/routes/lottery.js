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

// Buy lottery tickets with tokens
router.post('/buy-tickets', authenticateToken, async (req, res) => {
  try {
    const { quantity = 1 } = req.body;
    const userId = req.user.id;
    
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: 'Invalid ticket quantity (1-10)' });
    }
    
    // Get current lottery round
    const currentRound = await db.query(`
      SELECT * FROM lottery_rounds 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (currentRound.rows.length === 0) {
      return res.status(404).json({ error: 'No active lottery round' });
    }
    
    const round = currentRound.rows[0];
    const ticketCost = 5; // 5 BET tokens per ticket
    const totalCost = quantity * ticketCost;
    
    // Check user has enough tokens
    if (req.user.total_tokens < totalCost) {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    // Check max tickets per user
    const userTicketsCount = await db.query(`
      SELECT COUNT(*) as count FROM lottery_tickets 
      WHERE user_id = ? AND lottery_round = ?
    `, [userId, round.id]);
    
    if (parseInt(userTicketsCount.rows[0].count) + quantity > 10) {
      return res.status(400).json({ error: 'Maximum 10 tickets per user per round' });
    }
    
    try {
      await db.query('BEGIN TRANSACTION');
      
      // Deduct tokens
      await db.query(
        'UPDATE users SET total_tokens = total_tokens - ? WHERE id = ?',
        [totalCost, userId]
      );
      
      // Create tickets
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticketNumber = `T${round.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const ticketResult = await db.query(`
          INSERT INTO lottery_tickets (user_id, ticket_number, lottery_round, earned_from)
          VALUES (?, ?, ?, 'purchase')
        `, [userId, ticketNumber, round.id]);
        tickets.push({ id: ticketResult.lastID, ticketNumber });
      }
      
      await db.query('COMMIT');
      
      // Buy tickets on blockchain if available
      let blockchainTxHash = null;
      try {
        blockchainTxHash = await blockchain.buyLotteryTickets(req.user.wallet_address, quantity);
      } catch (blockchainError) {
        console.error('Blockchain lottery purchase failed:', blockchainError);
      }
      
      // Emit real-time update
      req.io?.emit('lottery-tickets-purchased', {
        userId,
        username: req.user.username,
        roundId: round.id,
        quantity,
        totalCost,
        blockchainTxHash
      });
      
      res.json({
        message: `Successfully purchased ${quantity} lottery tickets`,
        tickets,
        totalCost,
        remainingTokens: req.user.total_tokens - totalCost,
        blockchainTxHash
      });
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }
  } catch (error) {
    console.error('Buy lottery tickets error:', error);
    res.status(500).json({ error: 'Failed to purchase tickets' });
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

      // Create new round for next week
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 7);
      
      const newRoundName = `Weekly Draw ${new Date().toISOString().split('T')[0]}`;
      await db.query(`
        INSERT INTO lottery_rounds (round_name, end_date, is_active)
        VALUES (?, ?, true)
      `, [newRoundName, newEndDate]);
      
      await db.query('COMMIT');
      
      // Draw on blockchain if available
      let blockchainTxHash = null;
      try {
        blockchainTxHash = await blockchain.drawLottery(req.user.wallet_address);
      } catch (blockchainError) {
        console.error('Blockchain lottery draw failed:', blockchainError);
      }
      
      // Award tokens to winner via blockchain
      try {
        await blockchain.awardTokens(
          winningTicket.wallet_address,
          100 * 1e18, // 100 BET tokens
          'Lottery Winner'
        );
      } catch (blockchainError) {
        console.error('Blockchain winner reward failed:', blockchainError);
      }
      
      // Emit celebration event
      req.io?.emit('lottery-winner', {
        winner: {
          id: winningTicket.user_id,
          username: winningTicket.username
        },
        ticketNumber: winningTicket.ticket_number,
        prize: 100,
        roundId: round.id,
        blockchainTxHash
      });
      
      res.json({
        message: 'Lottery drawn successfully!',
        winner: {
          id: winningTicket.user_id,
          username: winningTicket.username,
          ticketNumber: winningTicket.ticket_number
        },
        prize: 100,
        totalTickets: tickets.rows.length,
        blockchainTxHash
      });
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }
  } catch (error) {
    console.error('Draw lottery error:', error);
    res.status(500).json({ error: 'Failed to draw lottery' });
  }
});

// Create perk (admin only)
router.post('/perks', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      name,
      description,
      perkType = 'Custom',
      tokenValue = 0,
      quantity = 1,
      validityDays = 30
    } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }
    
    const result = await db.query(`
      INSERT INTO perks (name, description, perk_type, token_value, quantity, validity_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, description, perkType, tokenValue, quantity, validityDays]);
    
    const perk = {
      id: result.lastID,
      name,
      description,
      perk_type: perkType,
      token_value: tokenValue,
      quantity,
      validity_days: validityDays
    };
    
    res.status(201).json({
      message: 'Perk created successfully',
      perk
    });
  } catch (error) {
    console.error('Create perk error:', error);
    res.status(500).json({ error: 'Failed to create perk' });
  }
});

// Get available perks
router.get('/perks', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM perks 
      WHERE quantity > 0 AND is_active = true
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get perks error:', error);
    res.status(500).json({ error: 'Failed to fetch perks' });
  }
});

// Redeem perk with tokens
router.post('/perks/:id/redeem', authenticateToken, async (req, res) => {
  try {
    const perkId = req.params.id;
    const userId = req.user.id;
    
    // Get perk details
    const perkResult = await db.query('SELECT * FROM perks WHERE id = ?', [perkId]);
    if (perkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Perk not found' });
    }
    
    const perk = perkResult.rows[0];
    
    if (perk.quantity <= 0) {
      return res.status(400).json({ error: 'Perk out of stock' });
    }
    
    if (req.user.total_tokens < perk.token_value) {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    try {
      await db.query('BEGIN TRANSACTION');
      
      // Deduct tokens
      await db.query(
        'UPDATE users SET total_tokens = total_tokens - ? WHERE id = ?',
        [perk.token_value, userId]
      );
      
      // Reduce perk quantity
      await db.query(
        'UPDATE perks SET quantity = quantity - 1 WHERE id = ?',
        [perkId]
      );
      
      // Create redemption record
      const redemptionCode = `PERK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      await db.query(`
        INSERT INTO perk_redemptions (user_id, perk_type, perk_description, tokens_spent, redemption_code)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, perk.perk_type, perk.description, perk.token_value, redemptionCode]);
      
      await db.query('COMMIT');
      
      // Spend tokens on blockchain
      try {
        await blockchain.spendTokens(
          req.user.wallet_address,
          perk.token_value * 1e18,
          `Perk: ${perk.name}`
        );
      } catch (blockchainError) {
        console.error('Blockchain spend tokens failed:', blockchainError);
      }
      
      // Emit notification
      req.io?.to(`user-${userId}`).emit('perk-redeemed', {
        perkName: perk.name,
        redemptionCode,
        tokensSpent: perk.token_value
      });
      
      res.json({
        message: 'Perk redeemed successfully!',
        redemptionCode,
        perk: {
          name: perk.name,
          description: perk.description
        },
        tokensSpent: perk.token_value,
        remainingTokens: req.user.total_tokens - perk.token_value
      });
    } catch (dbError) {
      await db.query('ROLLBACK');
      throw dbError;
    }
  } catch (error) {
    console.error('Redeem perk error:', error);
    res.status(500).json({ error: 'Failed to redeem perk' });
  }
});

// Get user's perk redemptions
router.get('/my-perks', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM perk_redemptions 
      WHERE user_id = ? 
      ORDER BY redeemed_at DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get user perks error:', error);
    res.status(500).json({ error: 'Failed to fetch user perks' });
  }
});

module.exports = router;
