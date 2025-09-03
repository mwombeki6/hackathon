-- BlockEngage Database Schema for PostgreSQL
-- Drop existing tables if they exist
DROP TABLE IF EXISTS user_activities CASCADE;
DROP TABLE IF EXISTS weekly_scores CASCADE;
DROP TABLE IF EXISTS user_leagues CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS head_to_head CASCADE;
DROP TABLE IF EXISTS lottery_tickets CASCADE;
DROP TABLE IF EXISTS perk_redemptions CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Additional tables for voting and lottery
CREATE TABLE polls (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    end_date TIMESTAMP NOT NULL,
    token_cost INTEGER DEFAULT 5,
    created_by INTEGER REFERENCES users(id),
    nominees JSONB NOT NULL, -- Array of user IDs
    winner_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    blockchain_tx_hash VARCHAR(66),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id),
    voter_id INTEGER REFERENCES users(id),
    nominee_id INTEGER REFERENCES users(id),
    tokens_spent INTEGER NOT NULL,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poll_id, voter_id)
);

CREATE TABLE lottery_rounds (
    id SERIAL PRIMARY KEY,
    round_name VARCHAR(100) NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    actual_end_date TIMESTAMP,
    winner_id INTEGER REFERENCES users(id),
    perk_description TEXT DEFAULT 'Mystery Perk',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'team_member', -- team_member, project_lead, reviewer, admin
    department VARCHAR(100),
    total_tokens INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT NULL,
    streak_level VARCHAR(50) DEFAULT 'none', -- none, bronze, silver, gold
    badges JSONB DEFAULT '[]', -- Array of earned badges
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    estimated_hours INTEGER,
    actual_hours INTEGER,
    due_date TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    completion_date TIMESTAMP,
    blockchain_tx_hash VARCHAR(66), -- Transaction hash on AlphachainLive
    token_reward INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task assignments history
CREATE TABLE task_assignments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id),
    assigned_to INTEGER REFERENCES users(id),
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blockchain_tx_hash VARCHAR(66)
);

-- User activities for streak tracking
CREATE TABLE user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    activity_date DATE NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- task_completed, peer_recognition, login
    points_earned INTEGER DEFAULT 0,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leagues table
CREATE TABLE leagues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tier INTEGER DEFAULT 1, -- For promotions/relegations
    season_start DATE NOT NULL,
    season_end DATE,
    max_members INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User league memberships
CREATE TABLE user_leagues (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    league_id INTEGER REFERENCES leagues(id),
    total_points INTEGER DEFAULT 0,
    rank INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, league_id)
);

-- Weekly scores for leagues
CREATE TABLE weekly_scores (
    id SERIAL PRIMARY KEY,
    user_league_id INTEGER REFERENCES user_leagues(id),
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tokens_earned INTEGER DEFAULT 0,
    peer_recognitions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Head-to-head competitions
CREATE TABLE head_to_head (
    id SERIAL PRIMARY KEY,
    challenger_id INTEGER REFERENCES users(id),
    opponent_id INTEGER REFERENCES users(id),
    challenge_type VARCHAR(50) DEFAULT 'weekly', -- weekly, monthly, custom
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    challenger_score INTEGER DEFAULT 0,
    opponent_score INTEGER DEFAULT 0,
    winner_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, cancelled
    stake_tokens INTEGER DEFAULT 0, -- Tokens staked for the challenge
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lottery tickets
CREATE TABLE lottery_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    lottery_round INTEGER NOT NULL,
    earned_from VARCHAR(100), -- task_completion, milestone, bonus
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Perk redemptions
CREATE TABLE perk_redemptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    perk_type VARCHAR(100) NOT NULL, -- coffee_voucher, parking_spot, remote_day
    perk_description TEXT,
    tokens_spent INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, fulfilled, cancelled
    redemption_code VARCHAR(50),
    blockchain_tx_hash VARCHAR(66),
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional indexes for new tables
CREATE INDEX idx_polls_active ON polls(is_active, end_date);
CREATE INDEX idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX idx_lottery_rounds_active ON lottery_rounds(is_active);
CREATE INDEX idx_weekly_scores_user_league ON weekly_scores(user_league_id, week_number, year);

-- Indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_user_activities_user_date ON user_activities(user_id, activity_date);
CREATE INDEX idx_user_leagues_league_id ON user_leagues(league_id);
CREATE INDEX idx_weekly_scores_week ON weekly_scores(week_number, year);
CREATE INDEX idx_h2h_participants ON head_to_head(challenger_id, opponent_id);
CREATE INDEX idx_lottery_tickets_round ON lottery_tickets(lottery_round);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
