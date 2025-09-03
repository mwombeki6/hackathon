const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../blockengage.db');

// Remove existing database
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

// Create tables directly with proper SQLite syntax
const createTables = [
    `CREATE TABLE users (
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
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        estimated_hours INTEGER,
        actual_hours INTEGER,
        due_date DATETIME,
        created_by INTEGER REFERENCES users(id),
        assigned_to INTEGER REFERENCES users(id),
        reviewed_by INTEGER REFERENCES users(id),
        completion_date DATETIME,
        blockchain_tx_hash VARCHAR(66),
        token_reward INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE user_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        activity_date DATE NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        description TEXT,
        evidence_file VARCHAR(255),
        points_earned INTEGER DEFAULT 0,
        blockchain_tx_hash VARCHAR(66),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        tier INTEGER DEFAULT 1,
        season_start DATE NOT NULL,
        season_end DATE,
        max_members INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE user_leagues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        league_id INTEGER REFERENCES leagues(id),
        total_points INTEGER DEFAULT 0,
        rank INTEGER DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, league_id)
    )`,
    
    `CREATE TABLE head_to_head (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        challenger_id INTEGER REFERENCES users(id),
        opponent_id INTEGER REFERENCES users(id),
        challenge_type VARCHAR(50) DEFAULT 'weekly',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        challenger_score INTEGER DEFAULT 0,
        opponent_score INTEGER DEFAULT 0,
        winner_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        stake_tokens INTEGER DEFAULT 0,
        blockchain_tx_hash VARCHAR(66),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        end_date DATETIME NOT NULL,
        token_cost INTEGER DEFAULT 5,
        created_by INTEGER REFERENCES users(id),
        nominees TEXT NOT NULL,
        winner_id INTEGER REFERENCES users(id),
        is_active BOOLEAN DEFAULT 1,
        blockchain_tx_hash VARCHAR(66),
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE poll_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER REFERENCES polls(id),
        option_text VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER REFERENCES polls(id),
        user_id INTEGER REFERENCES users(id),
        poll_option_id INTEGER REFERENCES poll_options(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(poll_id, user_id)
    )`
];

async function createDatabase() {
    console.log('Creating database tables...');
    
    for (let i = 0; i < createTables.length; i++) {
        await new Promise((resolve, reject) => {
            db.run(createTables[i], function(err) {
                if (err) {
                    console.error(`Error creating table ${i + 1}:`, err.message);
                    reject(err);
                } else {
                    console.log(`Created table ${i + 1}`);
                    resolve();
                }
            });
        });
    }
    
    console.log('Database created successfully!');
    db.close();
}

createDatabase().catch(console.error);
