-- Supabase Database Schema for Discord Invite Tracker Bot
-- This should be run in the Supabase SQL editor

-- Users table for tracking Discord users and their invite stats
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    account_age TIMESTAMP,
    joins INTEGER DEFAULT 0,
    leaves INTEGER DEFAULT 0,
    bonus INTEGER DEFAULT 0,
    fake INTEGER DEFAULT 0,
    total_invites INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Join log table for tracking all member joins
CREATE TABLE IF NOT EXISTS join_log (
    id SERIAL PRIMARY KEY,
    inviter_id VARCHAR(20),
    invited_user_id VARCHAR(20) NOT NULL,
    invited_username VARCHAR(100),
    invite_code VARCHAR(50),
    guild_id VARCHAR(20) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_smartlink_done BOOLEAN DEFAULT FALSE,
    is_left BOOLEAN DEFAULT FALSE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guild configuration table
CREATE TABLE IF NOT EXISTS guild_config (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) UNIQUE NOT NULL,
    minimum_account_age INTEGER DEFAULT 30,
    welcome_channel_id VARCHAR(20),
    log_channel_id VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invite rewards table for role rewards based on invite count
CREATE TABLE IF NOT EXISTS invite_rewards (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    required_invites INTEGER NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    reward_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Claims table for tracking reward claims
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    guild_id VARCHAR(20) NOT NULL,
    claim_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    reward_details JSONB,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Payouts table for tracking actual reward distributions
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER REFERENCES claims(id),
    user_id VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    payout_method VARCHAR(50),
    transaction_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_join_log_inviter_id ON join_log(inviter_id);
CREATE INDEX IF NOT EXISTS idx_join_log_invited_user_id ON join_log(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_join_log_guild_id ON join_log(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_guild_id ON invite_rewards(guild_id);
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);

-- Enable Row Level Security (RLS) for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (bot operations)
CREATE POLICY "Service role can manage all users" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all join_log" ON join_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all guild_config" ON guild_config
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all invite_rewards" ON invite_rewards
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all claims" ON claims
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all payouts" ON payouts
    FOR ALL USING (auth.role() = 'service_role');