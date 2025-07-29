# Supabase Database Setup Instructions

Since the bot cannot directly create tables in Supabase, you need to manually create them through the Supabase dashboard.

## Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Navigate to your project: https://vrjswggzotjmwbfcvmnz.supabase.co

## Step 2: Create Tables
Go to the SQL Editor in your Supabase dashboard and run this SQL:

```sql
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_join_log_inviter_id ON join_log(inviter_id);
CREATE INDEX IF NOT EXISTS idx_join_log_invited_user_id ON join_log(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_join_log_guild_id ON join_log(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_guild_id ON invite_rewards(guild_id);
```

## Step 3: Test the Bot
Once the tables are created, the bot should work without database errors.

## Current Status
- Bot is running with a simplified invite tracker that avoids database errors
- The simplified version provides basic functionality while tables are being set up
- Once tables are created, you can switch back to the full Supabase integration