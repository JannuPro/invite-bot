const { EmbedBuilder } = require('discord.js');

class SimplifiedInviteTracker {
    constructor(client) {
        this.client = client;
        this.guildInvites = new Map(); // Cache for guild invites
        this.userData = new Map(); // Store user invite data in memory
    }

    async init() {
        console.log('🔄 Initializing simplified invite tracker...');
        
        try {
            // Cache invites for all guilds
            for (const guild of this.client.guilds.cache.values()) {
                await this.cacheGuildInvites(guild);
            }
            
            console.log('✅ Simplified invite tracker initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing invite tracker:', error);
        }
    }

    /**
     * Cache all invites for a guild
     * @param {Guild} guild - Discord guild object
     * @returns {Promise<void>}
     */
    async cacheGuildInvites(guild) {
        try {
            const invites = await guild.invites.fetch();
            const inviteData = new Map();
            
            for (const [code, invite] of invites) {
                inviteData.set(code, {
                    code: invite.code,
                    uses: invite.uses || 0,
                    inviterId: invite.inviter?.id || null
                });
            }
            
            this.guildInvites.set(guild.id, inviteData);
            console.log(`📈 Cached ${invites.size} invites for guild ${guild.name}`);
        } catch (error) {
            console.error(`❌ Failed to cache invites for guild ${guild.name}:`, error);
        }
    }

    /**
     * Get user data from memory storage
     * @param {string} userId - Discord user ID
     * @returns {Promise<Object|null>} User data or null if not found
     */
    async getUser(userId) {
        // Check if user exists in memory
        if (this.userData.has(userId)) {
            return this.userData.get(userId);
        }
        
        // Return default user structure if not found
        const defaultUser = {
            user_id: userId,
            username: 'Unknown',
            total_invites: 0,
            joins: 0,
            bonus: 0,
            leaves: 0,
            fake: 0
        };
        
        // Store the default user
        this.userData.set(userId, defaultUser);
        return defaultUser;
    }

    /**
     * Create a new user (simplified)
     * @param {string} userId - Discord user ID
     * @param {string} username - Discord username
     * @param {string} displayName - Discord display name
     * @param {Date} accountAge - Account creation date
     * @returns {Promise<Object>} Created user data
     */
    async createUser(userId, username, displayName, accountAge) {
        console.log(`📝 Creating user record for ${username} (${userId})`);
        const newUser = {
            user_id: userId,
            username: username,
            display_name: displayName,
            account_age: accountAge,
            joins: 0,
            leaves: 0,
            bonus: 0,
            fake: 0,
            total_invites: 0
        };
        
        // Store the new user in memory
        this.userData.set(userId, newUser);
        return newUser;
    }

    /**
     * Handle member join (simplified)
     * @param {GuildMember} member - The member who joined
     * @returns {Promise<void>}
     */
    async handleMemberJoin(member) {
        console.log(`👋 ${member.user.username} joined ${member.guild.name}`);
        
        // Create user if doesn't exist
        let user = await this.getUser(member.user.id);
        if (!user) {
            user = await this.createUser(
                member.user.id, 
                member.user.username, 
                member.displayName, 
                member.user.createdAt
            );
        }
    }

    /**
     * Handle member leave (simplified)
     * @param {GuildMember} member - Member who left
     * @returns {Promise<void>}
     */
    async handleMemberLeave(member) {
        console.log(`👋 ${member.user.username} left ${member.guild.name}`);
    }

    /**
     * Get invite leaderboard (simplified)
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of results to return
     * @returns {Promise<Array>} Leaderboard data
     */
    async getLeaderboard(guildId, limit = 10) {
        // Return mock data for now
        return [
            { user_id: '123', username: 'User1', total_invites: 10, joins: 8, bonus: 2 },
            { user_id: '456', username: 'User2', total_invites: 5, joins: 5, bonus: 0 },
            { user_id: '789', username: 'User3', total_invites: 3, joins: 3, bonus: 0 }
        ];
    }

    /**
     * Add bonus invites to a user
     * @param {string} userId - Discord user ID
     * @param {number} amount - Number of bonus invites to add
     * @returns {Promise<Object>} Updated user data
     */
    async addBonusInvites(userId, amount) {
        console.log(`💰 Adding ${amount} bonus invites to user ${userId}`);
        const user = await this.getUser(userId);
        user.bonus += amount;
        user.total_invites = user.joins + user.bonus - user.leaves - user.fake;
        
        // Store updated user data
        this.userData.set(userId, user);
        console.log(`✅ User ${userId} now has ${user.total_invites} total invites`);
        return user;
    }

    /**
     * Add invite record (simplified)
     * @param {string} inviterId - ID of user who invited
     * @param {string} invitedId - ID of user who was invited
     * @param {string} invitedUsername - Username of invited user
     * @param {string} source - Source of invite (manual, etc.)
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async addInvite(inviterId, invitedId, invitedUsername, source = 'manual', guildId = null) {
        console.log(`📝 Adding invite record: ${inviterId} invited ${invitedUsername} (${invitedId})`);
        // In simplified version, just log the action
    }

    /**
     * Update user invite counts
     * @param {string} userId - User ID
     * @param {number} joins - Regular invites to add
     * @param {number} bonus - Bonus invites to add
     * @param {number} leaves - Leave count to add
     * @param {number} fake - Fake invites to add
     * @returns {Promise<Object>} Updated user data
     */
    async updateUserInvites(userId, joins = 0, bonus = 0, leaves = 0, fake = 0) {
        console.log(`📊 Updating invites for ${userId}: +${joins} joins, +${bonus} bonus, +${leaves} leaves, +${fake} fake`);
        const user = await this.getUser(userId);
        
        user.joins += joins;
        user.bonus += bonus;
        user.leaves += leaves;
        user.fake += fake;
        user.total_invites = user.joins + user.bonus - user.leaves - user.fake;
        
        // Store updated user data
        this.userData.set(userId, user);
        console.log(`✅ User ${userId} now has ${user.total_invites} total invites (${user.joins} joins + ${user.bonus} bonus - ${user.leaves} leaves - ${user.fake} fake)`);
        
        return user;
    }

    /**
     * Remove invites from a user
     * @param {string} userId - Discord user ID
     * @param {number} amount - Number of invites to remove
     * @returns {Promise<Object>} Updated user data
     */
    async removeInvites(userId, amount) {
        try {
            console.log(`➖ Removing ${amount} invites from user ${userId}`);
            
            // Get current user data
            const user = await this.getUser(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Calculate new values (remove from bonus first, then from joins)
            let newBonus = Math.max(0, user.bonus - amount);
            let remainingToRemove = Math.max(0, amount - user.bonus);
            let newJoins = Math.max(0, user.joins - remainingToRemove);

            const { data, error } = await this.supabase
                .from('users')
                .update({
                    joins: newJoins,
                    bonus: newBonus
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;

            console.log(`✅ Removed ${amount} invites from user ${userId}`);
            // Return updated user with calculated total
            return await this.getUser(userId);
        } catch (error) {
            console.error('Error removing invites:', error);
            throw error;
        }
    }

    /**
     * Get guild config
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object|null>} Guild config or null
     */
    async getGuildConfig(guildId) {
        try {
            const { data, error } = await this.supabase
                .from('guild_config')
                .select('*')
                .eq('guild_id', guildId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                throw error;
            }

            return data || {
                guild_id: guildId,
                minimum_account_age: 30,
                welcome_channel_id: null,
                log_channel_id: null
            };
        } catch (error) {
            console.error('Error getting guild config:', error);
            return {
                guild_id: guildId,
                minimum_account_age: 30,
                welcome_channel_id: null,
                log_channel_id: null
            };
        }
    }

    /**
     * Set guild config
     * @param {string} guildId - Guild ID
     * @param {Object} config - Config object to update
     * @returns {Promise<Object>} Updated config
     */
    async setGuildConfig(guildId, config) {
        try {
            const { data, error } = await this.supabase
                .from('guild_config')
                .upsert({
                    guild_id: guildId,
                    ...config
                }, {
                    onConflict: 'guild_id'
                })
                .select()
                .single();

            if (error) throw error;
            
            console.log(`✅ Updated guild config for ${guildId}`);
            return data;
        } catch (error) {
            console.error('Error setting guild config:', error);
            throw error;
        }
    }

    /**
     * Get invite rewards for a guild (simplified)
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} Array of reward configurations
     */
    async getInviteRewards(guildId) {
        return [
            { required_invites: 1, role_id: '1398018785461538878', reward_name: 'Member' },
            { required_invites: 5, role_id: 'reward_role_5', reward_name: 'Supporter' },
            { required_invites: 10, role_id: 'reward_role_10', reward_name: 'Champion' }
        ];
    }

    /**
     * Check and assign role rewards (simplified)
     * @param {Guild} guild - Discord guild
     * @param {string} userId - User ID to check rewards for
     * @returns {Promise<void>}
     */
    async checkRoleRewards(guild, userId) {
        console.log(`🏆 Checking role rewards for user ${userId} in guild ${guild.name}`);
        // Simplified - just log for now
    }

    /**
     * Send welcome message (simplified)
     * @param {GuildMember} member - Member who joined
     * @param {string} inviterId - ID of who invited them
     * @param {boolean} isAccountOldEnough - Whether account meets age requirements
     * @returns {Promise<void>}
     */
    async sendWelcomeMessage(member, inviterId, isAccountOldEnough) {
        console.log(`📨 Sending welcome message to ${member.user.username}`);
        // Simplified - just log for now
    }
}

module.exports = SimplifiedInviteTracker;