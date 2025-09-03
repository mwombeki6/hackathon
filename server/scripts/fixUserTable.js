const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function fixUserTable() {
    try {
        console.log('Backing up user data...');
        const users = await db.query('SELECT * FROM users');
        
        console.log('Dropping and recreating users table...');
        await db.query('DROP TABLE IF EXISTS users');
        
        await db.query(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address VARCHAR(42) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'team_member',
                department VARCHAR(100),
                total_tokens INTEGER DEFAULT 0,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                last_activity_date DATE DEFAULT NULL,
                streak_level VARCHAR(50) DEFAULT 'none',
                badges TEXT DEFAULT '[]',
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Restoring user data with proper password hashes...');
        const correctHash = await bcrypt.hash('user123', 10);
        
        for (const user of users) {
            await db.query(`
                INSERT INTO users (
                    id, wallet_address, email, username, full_name, role, department,
                    total_tokens, current_streak, longest_streak, last_activity_date,
                    streak_level, badges, password_hash, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                user.id, user.wallet_address, user.email, user.username, user.full_name,
                user.role, user.department, user.total_tokens, user.current_streak,
                user.longest_streak, user.last_activity_date, user.streak_level,
                user.badges, correctHash, user.created_at, user.updated_at
            ]);
        }
        
        console.log(`Fixed ${users.length} users with proper password hashes`);
        process.exit(0);
    } catch (error) {
        console.error('Error fixing user table:', error);
        process.exit(1);
    }
}

fixUserTable();
