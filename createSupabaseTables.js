const { supabase } = require('./supabaseClient.js');

async function createTables() {
    console.log('🔄 Creating Supabase tables...');
    
    try {
        // Create users table using direct SQL
        const { error: usersError } = await supabase
            .from('_sql')
            .select()
            .eq('query', `CREATE TABLE IF NOT EXISTS users (
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
            );`);
        
        if (usersError) {
            console.error('Error creating users table:', usersError);
        } else {
            console.log('✅ Users table created successfully');
        }

        // Create join_log table
        const { error: joinLogError } = await supabase.rpc('exec_sql', {
            query: `
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
            `
        });
        
        if (joinLogError) {
            console.error('Error creating join_log table:', joinLogError);
        } else {
            console.log('✅ Join_log table created successfully');
        }

        // Create guild_config table
        const { error: guildConfigError } = await supabase.rpc('exec_sql', {
            query: `
                CREATE TABLE IF NOT EXISTS guild_config (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) UNIQUE NOT NULL,
                    minimum_account_age INTEGER DEFAULT 30,
                    welcome_channel_id VARCHAR(20),
                    log_channel_id VARCHAR(20),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (guildConfigError) {
            console.error('Error creating guild_config table:', guildConfigError);
        } else {
            console.log('✅ Guild_config table created successfully');
        }

        // Create invite_rewards table
        const { error: inviteRewardsError } = await supabase.rpc('exec_sql', {
            query: `
                CREATE TABLE IF NOT EXISTS invite_rewards (
                    id SERIAL PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    required_invites INTEGER NOT NULL,
                    role_id VARCHAR(20) NOT NULL,
                    reward_name VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (inviteRewardsError) {
            console.error('Error creating invite_rewards table:', inviteRewardsError);
        } else {
            console.log('✅ Invite_rewards table created successfully');
        }

        // Create indexes
        const { error: indexError } = await supabase.rpc('exec_sql', {
            query: `
                CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
                CREATE INDEX IF NOT EXISTS idx_join_log_inviter_id ON join_log(inviter_id);
                CREATE INDEX IF NOT EXISTS idx_join_log_invited_user_id ON join_log(invited_user_id);
                CREATE INDEX IF NOT EXISTS idx_join_log_guild_id ON join_log(guild_id);
                CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id);
                CREATE INDEX IF NOT EXISTS idx_invite_rewards_guild_id ON invite_rewards(guild_id);
            `
        });
        
        if (indexError) {
            console.error('Error creating indexes:', indexError);
        } else {
            console.log('✅ Database indexes created successfully');
        }

        console.log('🎉 All Supabase tables created successfully!');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    }
}

// Run if called directly
if (require.main === module) {
    createTables().then(() => {
        console.log('✅ Table creation completed');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Table creation failed:', error);
        process.exit(1);
    });
}

module.exports = { createTables };