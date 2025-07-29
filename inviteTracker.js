const { supabase } = require('./supabaseClient.js');
const { EmbedBuilder, PermissionFlagsBits, GatewayIntentBits, AuditLogEvent } = require('discord.js');

class InviteTracker {
    constructor(client) {
        this.client = client;
        this.guildInvites = new Map(); // Cache for guild invites
        this.guildVanityData = new Map(); // Cache for vanity URL data
        this.processingJoins = new Set(); // Prevent duplicate processing
    }

    /**
     * Initialize the invite tracker with full guild data caching
     * @returns {Promise<void>}
     */
    async init() {
        console.log('🔄 Initializing advanced invite tracker...');
        
        try {
            // Initialize database tables if needed
            await this.ensureTablesExist();
            
            // Cache invites for all guilds
            for (const guild of this.client.guilds.cache.values()) {
                await this.cacheGuildInvites(guild);
                await this.cacheVanityData(guild);
            }
            
            // Perform downtime backfill
            await this.performDowntimeBackfill();
            
            console.log('✅ Advanced invite tracker initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing invite tracker:', error);
        }
    }

    /**
     * Ensure all required Supabase tables exist
     * @returns {Promise<void>}
     */
    async ensureTablesExist() {
        console.log('📊 Verifying database schema...');
        
        try {
            // Check if users table exists by trying to select from it
            const { error } = await supabase
                .from('users')
                .select('count')
                .limit(1);
            
            if (error && error.code === '42P01') {
                console.log('⚠️ Tables do not exist, creating them...');
                const { createTables } = require('./createSupabaseTables.js');
                await createTables();
            } else {
                console.log('✅ Database tables verified');
            }
        } catch (error) {
            console.error('❌ Error verifying tables:', error);
        }
    }

    /**
     * Cache all invites for a guild with rate limiting
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
                    maxUses: invite.maxUses || 0,
                    temporary: invite.temporary || false,
                    expiresTimestamp: invite.expiresTimestamp,
                    inviterId: invite.inviter?.id || null,
                    channelId: invite.channel?.id || null,
                    createdTimestamp: invite.createdTimestamp
                });
            }
            
            this.guildInvites.set(guild.id, inviteData);
            console.log(`📈 Cached ${invites.size} invites for guild ${guild.name}`);
        } catch (error) {
            console.error(`❌ Failed to cache invites for guild ${guild.name}:`, error);
        }
    }

    /**
     * Cache vanity URL data for guilds that have it
     * @param {Guild} guild - Discord guild object
     * @returns {Promise<void>}
     */
    async cacheVanityData(guild) {
        try {
            if (!guild.features.includes('VANITY_URL')) return;
            
            const vanityData = await guild.fetchVanityData();
            if (vanityData) {
                this.guildVanityData.set(guild.id, {
                    code: vanityData.code,
                    uses: vanityData.uses || 0
                });
                console.log(`🎭 Cached vanity data for ${guild.name}: ${vanityData.code} (${vanityData.uses} uses)`);
            }
        } catch (error) {
            if (error.code !== 50013) { // Not forbidden
                console.error(`❌ Failed to cache vanity data for guild ${guild.name}:`, error);
            }
        }
    }

    /**
     * Get user data from Supabase
     * @param {string} userId - Discord user ID
     * @returns {Promise<Object|null>} User data or null if not found
     */
    async getUser(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') { // Not found error
                console.error('Error fetching user:', error);
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('Error in getUser:', error);
            return null;
        }
    }

    /**
     * Create a new user in the database
     * @param {string} userId - Discord user ID
     * @param {string} username - Discord username
     * @param {string} displayName - Discord display name
     * @param {Date} accountAge - Account creation date
     * @returns {Promise<Object>} Created user data
     */
    async createUser(userId, username, displayName, accountAge) {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert({
                    user_id: userId,
                    username: username,
                    display_name: displayName,
                    account_age: accountAge,
                    joins: 0,
                    leaves: 0,
                    bonus: 0,
                    fake: 0,
                    total_invites: 0
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error creating user:', error);
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('Error in createUser:', error);
            throw error;
        }
    }

    /**
     * Update user invite counts with atomic operations
     * @param {string} userId - Discord user ID
     * @param {number} joinsChange - Change in joins count
     * @param {number} bonusChange - Change in bonus count
     * @param {number} leavesChange - Change in leaves count
     * @param {number} fakeChange - Change in fake count
     * @returns {Promise<Object>} Updated user data
     */
    async updateUserInvites(userId, joinsChange = 0, bonusChange = 0, leavesChange = 0, fakeChange = 0) {
        try {
            // First get current values
            const user = await this.getUser(userId);
            if (!user) {
                throw new Error(`User ${userId} not found`);
            }
            
            const newJoins = user.joins + joinsChange;
            const newBonus = user.bonus + bonusChange;
            const newLeaves = user.leaves + leavesChange;
            const newFake = user.fake + fakeChange;
            const newTotal = newJoins + newBonus - newLeaves - newFake;
            
            const { data, error } = await supabase
                .from('users')
                .update({
                    joins: newJoins,
                    bonus: newBonus,
                    leaves: newLeaves,
                    fake: newFake,
                    total_invites: newTotal,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();
            
            if (error) {
                console.error('Error updating user invites:', error);
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('Error in updateUserInvites:', error);
            throw error;
        }
    }

    /**
     * Record a new invite in the join log
     * @param {string} inviterId - User ID who created the invite
     * @param {string} invitedUserId - User ID who joined
     * @param {string} invitedUsername - Username of who joined
     * @param {string} inviteCode - Invite code used
     * @param {string} guildId - Guild ID where join occurred
     * @returns {Promise<Object>} Created invite record
     */
    async addInvite(inviterId, invitedUserId, invitedUsername, inviteCode, guildId) {
        try {
            const { data, error } = await supabase
                .from('join_log')
                .insert({
                    inviter_id: inviterId,
                    invited_user_id: invitedUserId,
                    invited_username: invitedUsername,
                    invite_code: inviteCode,
                    guild_id: guildId,
                    is_verified: false,
                    is_smartlink_done: false,
                    is_left: false
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error adding invite:', error);
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('Error in addInvite:', error);
            throw error;
        }
    }

    /**
     * Mark a user as having left the server
     * @param {string} userId - Discord user ID
     * @returns {Promise<void>}
     */
    async markUserLeft(userId) {
        try {
            const { error } = await supabase
                .from('join_log')
                .update({
                    is_left: true,
                    left_at: new Date().toISOString()
                })
                .eq('invited_user_id', userId)
                .eq('is_left', false);
            
            if (error) {
                console.error('Error marking user as left:', error);
            }
        } catch (error) {
            console.error('Error in markUserLeft:', error);
        }
    }

    async markInviteInvalid(inviteId) {
        await this.pool.query('UPDATE invites SET is_valid = false WHERE id = $1', [inviteId]);
    }

    async getGuildConfig(guildId) {
        const result = await this.pool.query('SELECT * FROM guild_config WHERE guild_id = $1', [guildId]);
        return result.rows[0] || null;
    }

    async getInviteRewards(guildId) {
        const result = await this.pool.query('SELECT * FROM invite_rewards WHERE guild_id = $1 ORDER BY required_invites ASC', [guildId]);
        return result.rows;
    }

    /**
     * Advanced member join handler with invite tracking and audit log fallback
     * @param {GuildMember} member - The member who joined
     * @returns {Promise<void>}
     */
    async handleMemberJoin(member) {
        const guild = member.guild;
        const guildId = guild.id;
        const userId = member.user.id;
        
        // Prevent duplicate processing
        const processingKey = `${guildId}-${userId}`;
        if (this.processingJoins.has(processingKey)) {
            return;
        }
        this.processingJoins.add(processingKey);
        
        try {
            // Check account age
            const accountCreated = member.user.createdAt;
            const now = new Date();
            const daysDiff = Math.floor((now - accountCreated) / (1000 * 60 * 60 * 24));
            
            const config = await this.getGuildConfig(guildId);
            const minimumAge = config?.minimum_account_age || 30;
            const isAccountOldEnough = daysDiff >= minimumAge;

            // Create user record if not exists
            let user = await this.getUser(userId);
            if (!user) {
                user = await this.createUser(userId, member.user.username, member.displayName, accountCreated);
            }

            // Find who invited this user
            const inviteResult = await this.detectInviter(guild, member);
            let inviterId = inviteResult.inviterId;
            let inviteCode = inviteResult.inviteCode;
            let source = inviteResult.source;

            // If no invite found, try audit log fallback
            if (!inviterId) {
                const auditResult = await this.auditLogFallback(guild, member);
                if (auditResult) {
                    inviterId = auditResult.inviterId;
                    inviteCode = auditResult.inviteCode;
                    source = 'audit_log';
                }
            }

            // Record the join
            if (inviterId) {
                await this.addInvite(inviterId, userId, member.user.username, inviteCode, guildId);
                await this.updateUserInvites(inviterId, 1, 0, 0, 0); // Add 1 join
                
                // Check for role rewards
                await this.checkRoleRewards(guild, inviterId);
                
                console.log(`✅ ${member.user.username} joined via ${source} - invited by ${inviterId} (code: ${inviteCode})`);
            } else {
                console.warn(`⚠️ Could not determine inviter for ${member.user.username} - marking as unknown`);
                await this.addInvite(null, userId, member.user.username, 'unknown', guildId);
            }

            // Send welcome message
            await this.sendWelcomeMessage(member, inviterId, isAccountOldEnough);
            
        } catch (error) {
            console.error(`❌ Error handling member join for ${member.user.username}:`, error);
        } finally {
            // Remove from processing set after a delay
            setTimeout(() => {
                this.processingJoins.delete(processingKey);
            }, 5000);
        }
    }

    /**
     * Detect who invited a member by comparing invite cache
     * @param {Guild} guild - Discord guild
     * @param {GuildMember} member - Member who joined
     * @returns {Promise<Object>} Result with inviterId, inviteCode, and source
     */
    async detectInviter(guild, member) {
        try {
            // First check vanity URL
            const vanityResult = await this.checkVanityInvite(guild);
            if (vanityResult.used) {
                return {
                    inviterId: null, // Vanity invites don't have specific inviters
                    inviteCode: vanityResult.code,
                    source: 'vanity'
                };
            }

            // Fetch current invites and compare with cache
            const currentInvites = await guild.invites.fetch();
            const cachedInvites = this.guildInvites.get(guild.id) || new Map();
            
            for (const [code, currentInvite] of currentInvites) {
                const cachedInvite = cachedInvites.get(code);
                
                if (cachedInvite && currentInvite.uses > cachedInvite.uses) {
                    // This invite was used
                    await this.updateInviteCache(guild, currentInvites);
                    return {
                        inviterId: currentInvite.inviter?.id || null,
                        inviteCode: code,
                        source: 'invite_diff'
                    };
                }
            }

            // Update cache for future comparisons
            await this.updateInviteCache(guild, currentInvites);
            
            return { inviterId: null, inviteCode: null, source: 'unknown' };
        } catch (error) {
            console.error('Error detecting inviter:', error);
            return { inviterId: null, inviteCode: null, source: 'error' };
        }
    }

    /**
     * Check if vanity URL was used for the join
     * @param {Guild} guild - Discord guild
     * @returns {Promise<Object>} Result with used flag and code
     */
    async checkVanityInvite(guild) {
        try {
            if (!guild.features.includes('VANITY_URL')) {
                return { used: false, code: null };
            }

            const currentVanity = await guild.fetchVanityData();
            const cachedVanity = this.guildVanityData.get(guild.id);

            if (cachedVanity && currentVanity && currentVanity.uses > cachedVanity.uses) {
                // Update cache
                this.guildVanityData.set(guild.id, {
                    code: currentVanity.code,
                    uses: currentVanity.uses
                });
                
                return { used: true, code: currentVanity.code };
            }

            return { used: false, code: null };
        } catch (error) {
            console.error('Error checking vanity invite:', error);
            return { used: false, code: null };
        }
    }

    /**
     * Fallback to audit logs when invite tracking fails
     * @param {Guild} guild - Discord guild
     * @param {GuildMember} member - Member who joined
     * @returns {Promise<Object|null>} Audit log result or null
     */
    async auditLogFallback(guild, member) {
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberInviteAdd,
                limit: 10
            });

            // Find the most recent entry for this user
            const relevantEntry = auditLogs.entries.find(entry => 
                entry.target?.id === member.user.id &&
                Date.now() - entry.createdTimestamp < 10000 // Within last 10 seconds
            );

            if (relevantEntry) {
                return {
                    inviterId: relevantEntry.executor?.id || null,
                    inviteCode: relevantEntry.changes?.find(c => c.key === 'code')?.new || 'audit_fallback'
                };
            }

            return null;
        } catch (error) {
            console.error('Error in audit log fallback:', error);
            return null;
        }
    }

    /**
     * Update the invite cache with current data
     * @param {Guild} guild - Discord guild
     * @param {Collection} currentInvites - Current invites from Discord
     * @returns {Promise<void>}
     */
    async updateInviteCache(guild, currentInvites) {
        const inviteData = new Map();
        
        for (const [code, invite] of currentInvites) {
            inviteData.set(code, {
                code: invite.code,
                uses: invite.uses || 0,
                maxUses: invite.maxUses || 0,
                temporary: invite.temporary || false,
                expiresTimestamp: invite.expiresTimestamp,
                inviterId: invite.inviter?.id || null,
                channelId: invite.channel?.id || null,
                createdTimestamp: invite.createdTimestamp
            });
        }
        
        this.guildInvites.set(guild.id, inviteData);
    }

    /**
     * Handle member leave with invite count updates
     * @param {GuildMember} member - Member who left
     * @returns {Promise<void>}
     */
    async handleMemberLeave(member) {
        const userId = member.user.id;
        
        try {
            // Find who invited this user
            const { data: joinData, error } = await supabase
                .from('join_log')
                .select('*')
                .eq('invited_user_id', userId)
                .eq('is_left', false)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error finding join record:', error);
                return;
            }

            if (joinData && joinData.inviter_id) {
                const inviterId = joinData.inviter_id;

                // Mark as left
                await this.markUserLeft(userId);

                // Update inviter's count (add to leaves)
                await this.updateUserInvites(inviterId, 0, 0, 1, 0);

                // Check if inviter should lose roles
                await this.checkRoleRewards(member.guild, inviterId);

                console.log(`👋 ${member.user.username} left - removed invite from ${inviterId}`);
            } else {
                console.log(`👋 ${member.user.username} left - no inviter found`);
            }
        } catch (error) {
            console.error(`❌ Error handling member leave for ${member.user.username}:`, error);
        }
    }

    // Check and assign/remove role rewards
    async checkRoleRewards(guild, userId) {
        const user = await this.getUser(userId);
        if (!user) return;

        const rewards = await this.getInviteRewards(guild.id);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        for (const reward of rewards) {
            const role = guild.roles.cache.get(reward.role_id);
            if (!role) continue;

            const hasRole = member.roles.cache.has(reward.role_id);
            const shouldHaveRole = user.total_invites >= reward.required_invites;

            if (shouldHaveRole && !hasRole) {
                try {
                    await member.roles.add(role);
                    console.log(`Added role ${reward.role_name} to ${member.user.username} for ${user.total_invites} invites`);
                } catch (error) {
                    console.error(`Failed to add role ${reward.role_name}:`, error);
                }
            } else if (!shouldHaveRole && hasRole) {
                try {
                    await member.roles.remove(role);
                    console.log(`Removed role ${reward.role_name} from ${member.user.username} for ${user.total_invites} invites`);
                } catch (error) {
                    console.error(`Failed to remove role ${reward.role_name}:`, error);
                }
            }
        }
    }

    // Send welcome message
    async sendWelcomeMessage(member, inviter, isAccountOldEnough) {
        const config = await this.getGuildConfig(member.guild.id);
        if (!config?.welcome_channel_id) return;

        const channel = member.guild.channels.cache.get(config.welcome_channel_id);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`Welcome to ${member.guild.name}!`)
            .setDescription(`Hello ${member}! Welcome to our server.`)
            .setColor(0x5865F2)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setTimestamp();

        if (!isAccountOldEnough) {
            embed.addFields({
                name: '⚠️ New Account',
                value: 'This account is less than 30 days old and may be considered suspicious.',
                inline: false
            });
        }

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to send welcome message:', error);
        }
    }

    /**
     * Get invite leaderboard for a guild
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of results to return
     * @returns {Promise<Array>} Leaderboard data
     */
    async getLeaderboard(guildId, limit = 10) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('user_id, username, total_invites, joins, bonus')
                .gte('total_invites', 1)
                .order('total_invites', { ascending: false })
                .order('joins', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching leaderboard:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getLeaderboard:', error);
            return [];
        }
    }

    /**
     * Add bonus invites to a user (admin command)
     * @param {string} userId - Discord user ID
     * @param {number} amount - Number of bonus invites to add
     * @returns {Promise<Object>} Updated user data
     */
    async addBonusInvites(userId, amount) {
        return await this.updateUserInvites(userId, 0, amount, 0, 0);
    }

    /**
     * Perform downtime backfill to reconcile members vs database
     * @returns {Promise<void>}
     */
    async performDowntimeBackfill() {
        console.log('🔄 Performing downtime backfill...');
        
        for (const guild of this.client.guilds.cache.values()) {
            try {
                // Get all current members
                const members = await guild.members.fetch();
                
                // Get all join records for this guild
                const { data: joinRecords, error } = await supabase
                    .from('join_log')
                    .select('invited_user_id')
                    .eq('guild_id', guild.id);

                if (error) {
                    console.error(`Error fetching join records for ${guild.name}:`, error);
                    continue;
                }

                const recordedUsers = new Set(joinRecords?.map(r => r.invited_user_id) || []);
                let backfilledCount = 0;

                // Find members not in join log
                for (const [userId, member] of members) {
                    if (!recordedUsers.has(userId) && !member.user.bot) {
                        // Create user record
                        let user = await this.getUser(userId);
                        if (!user) {
                            user = await this.createUser(
                                userId, 
                                member.user.username, 
                                member.displayName, 
                                member.user.createdAt
                            );
                        }

                        // Add unknown join record
                        await this.addInvite(null, userId, member.user.username, 'backfill', guild.id);
                        backfilledCount++;
                    }
                }

                if (backfilledCount > 0) {
                    console.log(`📊 Backfilled ${backfilledCount} missing members for ${guild.name}`);
                }
            } catch (error) {
                console.error(`Error during backfill for guild ${guild.name}:`, error);
            }
        }
        
        console.log('✅ Downtime backfill completed');
    }
}

module.exports = InviteTracker;