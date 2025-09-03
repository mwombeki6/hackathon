const { isToday, isYesterday, format } = require('date-fns');
const db = require('../config/database');
const blockchain = require('../config/blockchain');

async function updateStreak(userId) {
  try {
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    const today = new Date();
    const lastDate = user.last_activity_date ? new Date(user.last_activity_date) : null;
    
    let newStreak = user.current_streak;
    let bonusTokens = 0;
    let newLevel = user.streak_level;

    // Only update if not already updated today
    if (!lastDate || !isToday(lastDate)) {
      if (lastDate && isYesterday(lastDate)) {
        // Continue streak
        newStreak += 1;
      } else {
        // Start new streak
        newStreak = 1;
      }

      // Calculate longest streak
      const longestStreak = Math.max(user.longest_streak, newStreak);

      // Determine level and bonus rewards
      if (newStreak >= 30 && user.streak_level !== 'gold') {
        newLevel = 'gold';
        bonusTokens = 50;
      } else if (newStreak >= 14 && user.streak_level !== 'silver') {
        newLevel = 'silver';
        bonusTokens = 25;
      } else if (newStreak >= 7 && user.streak_level !== 'bronze') {
        newLevel = 'bronze';
        bonusTokens = 10;
      }

      // Update database
      await db.query(`
        UPDATE users 
        SET current_streak = $1, 
            longest_streak = $2, 
            last_activity_date = $3, 
            streak_level = $4,
            total_tokens = total_tokens + $5
        WHERE id = $6
      `, [newStreak, longestStreak, today, newLevel, bonusTokens, userId]);

      // Log activity
      await db.query(`
        INSERT INTO user_activities (user_id, activity_date, activity_type, points_earned)
        VALUES ($1, $2, 'streak_update', $3)
      `, [userId, today, bonusTokens]);

      // Award bonus tokens via blockchain if applicable
      if (bonusTokens > 0) {
        try {
          await blockchain.awardTokens(user.wallet_address, bonusTokens, `Streak milestone: ${newLevel}`);
        } catch (blockchainError) {
          console.error('Blockchain streak bonus failed:', blockchainError);
        }
      }

      return {
        newStreak,
        longestStreak,
        newLevel,
        bonusTokens,
        previousLevel: user.streak_level
      };
    }

    return {
      newStreak: user.current_streak,
      longestStreak: user.longest_streak,
      newLevel: user.streak_level,
      bonusTokens: 0,
      previousLevel: user.streak_level
    };
  } catch (error) {
    console.error('Update streak error:', error);
    throw error;
  }
}

async function checkAndResetInactiveStreaks() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Find users who were active yesterday but not today
    const result = await db.query(`
      SELECT id, current_streak, wallet_address 
      FROM users 
      WHERE last_activity_date < $1 AND current_streak > 0
    `, [yesterday]);

    for (const user of result.rows) {
      // Reset streak
      await db.query(`
        UPDATE users 
        SET current_streak = 0, streak_level = 'none'
        WHERE id = $1
      `, [user.id]);

      console.log(`Reset streak for user ${user.id}`);
    }

    return result.rows.length;
  } catch (error) {
    console.error('Reset streaks error:', error);
    throw error;
  }
}

module.exports = {
  updateStreak,
  checkAndResetInactiveStreaks
};
