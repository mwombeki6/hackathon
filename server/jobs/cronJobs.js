const cron = require('node-cron');
const db = require('../config/database');
const { checkAndResetInactiveStreaks } = require('../services/streakService');

// Daily streak check - runs at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily streak check...');
  try {
    const resetCount = await checkAndResetInactiveStreaks();
    console.log(`Reset ${resetCount} inactive streaks`);
  } catch (error) {
    console.error('Daily streak check failed:', error);
  }
});

// Weekly league score calculation - runs every Monday at 1 AM
cron.schedule('0 1 * * 1', async () => {
  console.log('Running weekly league score calculation...');
  try {
    await calculateWeeklyScores();
  } catch (error) {
    console.error('Weekly score calculation failed:', error);
  }
});

// Weekly lottery draw - runs every Friday at 5 PM
cron.schedule('0 17 * * 5', async () => {
  console.log('Running weekly lottery draw...');
  try {
    await autoDrawLottery();
  } catch (error) {
    console.error('Auto lottery draw failed:', error);
  }
});

// H2H match settlement - runs daily at 6 PM
cron.schedule('0 18 * * *', async () => {
  console.log('Checking for H2H matches to settle...');
  try {
    await settleExpiredMatches();
  } catch (error) {
    console.error('H2H settlement failed:', error);
  }
});

async function calculateWeeklyScores() {
  const currentWeek = getWeekNumber(new Date());
  const currentYear = new Date().getFullYear();
  
  // Get all active leagues
  const leagues = await db.query('SELECT * FROM leagues WHERE is_active = true');
  
  for (const league of leagues.rows) {
    // Get league members
    const members = await db.query('SELECT * FROM user_leagues WHERE league_id = $1', [league.id]);
    
    for (const member of members.rows) {
      // Calculate points from activities this week
      const weekStart = getWeekStart(currentWeek, currentYear);
      const weekEnd = getWeekEnd(currentWeek, currentYear);
      
      const activities = await db.query(`
        SELECT 
          COUNT(CASE WHEN activity_type = 'task_completed' THEN 1 END) as tasks_completed,
          SUM(CASE WHEN activity_type = 'task_completed' THEN points_earned ELSE 0 END) as tokens_earned,
          COUNT(CASE WHEN activity_type = 'peer_recognition_received' THEN 1 END) as recognitions
        FROM user_activities
        WHERE user_id = $1 AND activity_date BETWEEN $2 AND $3
      `, [member.user_id, weekStart, weekEnd]);
      
      const stats = activities.rows[0];
      const points = (stats.tasks_completed * 10) + (stats.tokens_earned * 0.1) + (stats.recognitions * 5);
      
      // Insert weekly score
      await db.query(`
        INSERT INTO weekly_scores (user_league_id, week_number, year, points, tasks_completed, tokens_earned, peer_recognitions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_league_id, week_number, year) 
        DO UPDATE SET points = $4, tasks_completed = $5, tokens_earned = $6, peer_recognitions = $7
      `, [member.id, currentWeek, currentYear, Math.floor(points), stats.tasks_completed, stats.tokens_earned, stats.recognitions]);
      
      // Update total points
      await db.query('UPDATE user_leagues SET total_points = total_points + $1 WHERE id = $2', [Math.floor(points), member.id]);
    }
  }
}

async function autoDrawLottery() {
  // Get current active round
  const currentRound = await db.query(`
    SELECT * FROM lottery_rounds WHERE is_active = true ORDER BY created_at DESC LIMIT 1
  `);
  
  if (currentRound.rows.length === 0) return;
  
  const round = currentRound.rows[0];
  
  // Check if round should end
  if (new Date() >= new Date(round.end_date)) {
    // Get all tickets
    const tickets = await db.query(`
      SELECT lt.*, u.wallet_address
      FROM lottery_tickets lt
      JOIN users u ON lt.user_id = u.id
      WHERE lt.lottery_round = $1 AND lt.is_used = false
    `, [round.id]);
    
    if (tickets.rows.length > 0) {
      // Draw winner
      const randomIndex = Math.floor(Math.random() * tickets.rows.length);
      const winningTicket = tickets.rows[randomIndex];
      
      await db.query('BEGIN');
      
      // Update round
      await db.query(`
        UPDATE lottery_rounds 
        SET winner_id = $1, is_active = false, actual_end_date = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [winningTicket.user_id, round.id]);
      
      // Mark ticket as used
      await db.query('UPDATE lottery_tickets SET is_used = true WHERE id = $1', [winningTicket.id]);
      
      // Award tokens
      await db.query('UPDATE users SET total_tokens = total_tokens + 100 WHERE id = $1', [winningTicket.user_id]);
      
      // Create new round
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 7);
      
      await db.query(`
        INSERT INTO lottery_rounds (round_name, start_date, end_date, perk_description)
        VALUES ($1, CURRENT_TIMESTAMP, $2, 'Mystery Perk')
      `, [`Round ${round.id + 1}`, newEndDate]);
      
      await db.query('COMMIT');
      
      console.log(`Lottery drawn - Winner: User ${winningTicket.user_id}`);
    }
  }
}

async function settleExpiredMatches() {
  // Get expired active matches
  const expiredMatches = await db.query(`
    SELECT * FROM head_to_head 
    WHERE status = 'active' AND end_date < CURRENT_DATE
  `);
  
  for (const match of expiredMatches.rows) {
    // Calculate scores from activities during match period
    const challengerScore = await calculateH2HScore(match.challenger_id, match.start_date, match.end_date);
    const opponentScore = await calculateH2HScore(match.opponent_id, match.start_date, match.end_date);
    
    let winnerId = null;
    if (challengerScore > opponentScore) {
      winnerId = match.challenger_id;
    } else if (opponentScore > challengerScore) {
      winnerId = match.opponent_id;
    }
    
    await db.query('BEGIN');
    
    // Update match
    await db.query(`
      UPDATE head_to_head 
      SET challenger_score = $1, opponent_score = $2, winner_id = $3, status = 'completed'
      WHERE id = $4
    `, [challengerScore, opponentScore, winnerId, match.id]);
    
    // Award winner
    if (winnerId) {
      const totalPrize = match.stake_tokens * 2 + 20; // Stake + bonus
      await db.query('UPDATE users SET total_tokens = total_tokens + $1 WHERE id = $2', [totalPrize, winnerId]);
    } else {
      // Tie - refund stakes
      await db.query('UPDATE users SET total_tokens = total_tokens + $1 WHERE id = $2', [match.stake_tokens, match.challenger_id]);
      await db.query('UPDATE users SET total_tokens = total_tokens + $1 WHERE id = $2', [match.stake_tokens, match.opponent_id]);
    }
    
    await db.query('COMMIT');
    
    console.log(`H2H match ${match.id} settled - Winner: ${winnerId || 'Tie'}`);
  }
}

async function calculateH2HScore(userId, startDate, endDate) {
  const result = await db.query(`
    SELECT 
      COUNT(CASE WHEN activity_type = 'task_completed' THEN 1 END) as tasks,
      SUM(CASE WHEN activity_type = 'task_completed' THEN points_earned ELSE 0 END) as tokens,
      COUNT(CASE WHEN activity_type = 'peer_recognition_received' THEN 1 END) as recognitions
    FROM user_activities
    WHERE user_id = $1 AND activity_date BETWEEN $2 AND $3
  `, [userId, startDate, endDate]);
  
  const stats = result.rows[0];
  return (stats.tasks * 10) + (stats.tokens * 0.1) + (stats.recognitions * 5);
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekStart(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

function getWeekEnd(week, year) {
  const start = getWeekStart(week, year);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

module.exports = {
  calculateWeeklyScores,
  autoDrawLottery,
  settleExpiredMatches
};
