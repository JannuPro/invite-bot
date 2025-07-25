const { Pool } = require('pg');
const { EmbedBuilder, PermissionFlagsBits, GatewayIntentBits } = require('discord.js');

class InviteTracker {
    constructor(client) {
        this.client = client;
        this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
        this.guildInvites = new Map(); // Cache for guild invites
    }

    async init() {
        // Initialize without privileged invites - will use manual verification system
        console.log('Invite tracker initialized in manual verification mode');
    }

    // Database helper methods
    async getUser(userId) {
        const result = await this.pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    }

    async createUser(userId, username, displayName, accountAge) {
        const result = await this.pool.query(
            'INSERT INTO users (user_id, username, display_name, account_age) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, username, displayName, accountAge]
        );
        return result.rows[0];
    }

    async updateUserInvites(userId, regularChange = 0, bonusChange = 0, leftChange = 0, fakeChange = 0) {
        const result = await this.pool.query(`
            UPDATE users 
            SET regular_invites = regular_invites + $2,
                bonus_invites = bonus_invites + $3,
                left_invites = left_invites + $4,
                fake_invites = fake_invites + $5,
                total_invites = regular_invites + bonus_invites - left_invites - fake_invites,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING *
        `, [userId, regularChange, bonusChange, leftChange, fakeChange]);
        return result.rows[0];
    }

    async addInvite(inviterId, invitedUserId, invitedUsername, inviteCode) {
        const result = await this.pool.query(
            'INSERT INTO invites (inviter_id, invited_user_id, invited_username, invite_code) VALUES ($1, $2, $3, $4) RETURNING *',
            [inviterId, invitedUserId, invitedUsername, inviteCode]
        );
        return result.rows[0];
    }

    async markUserLeft(userId) {
        await this.pool.query(
            'UPDATE invites SET is_left = true, left_at = CURRENT_TIMESTAMP WHERE invited_user_id = $1 AND is_left = false',
            [userId]
        );
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

    // Handle member join - simplified without invite tracking
    async handleMemberJoin(member) {
        const guild = member.guild;
        const guildId = guild.id;
        const userId = member.user.id;
        
        // Check account age (minimum 30 days old)
        const accountCreated = member.user.createdAt;
        const now = new Date();
        const daysDiff = Math.floor((now - accountCreated) / (1000 * 60 * 60 * 24));
        
        const config = await this.getGuildConfig(guildId);
        const minimumAge = config?.minimum_account_age || 30;
        
        const isAccountOldEnough = daysDiff >= minimumAge;

        // Create user record
        let user = await this.getUser(userId);
        if (!user) {
            user = await this.createUser(userId, member.user.username, member.displayName, accountCreated);
        }

        console.log(`${member.user.username} joined - account age: ${daysDiff} days (valid: ${isAccountOldEnough})`);

        // Send welcome message
        await this.sendWelcomeMessage(member, null, isAccountOldEnough);
    }

    // Handle member leave
    async handleMemberLeave(member) {
        const userId = member.user.id;
        
        // Find who invited this user and mark as left
        const inviteResult = await this.pool.query(
            'SELECT * FROM invites WHERE invited_user_id = $1 AND is_left = false AND is_valid = true',
            [userId]
        );

        if (inviteResult.rows.length > 0) {
            const invite = inviteResult.rows[0];
            const inviterId = invite.inviter_id;

            // Mark invite as left
            await this.markUserLeft(userId);

            // Update inviter's count (add to left_invites)
            await this.updateUserInvites(inviterId, 0, 0, 1, 0);

            // Check if inviter should lose roles
            await this.checkRoleRewards(member.guild, inviterId);

            console.log(`${member.user.username} left - removed invite from ${inviterId}`);
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

    // Get invite leaderboard
    async getLeaderboard(guildId, limit = 10) {
        const result = await this.pool.query(`
            SELECT users.*, 
                   (SELECT COUNT(*) FROM invites WHERE inviter_id = users.user_id AND is_valid = true AND is_left = false) as active_invites
            FROM users 
            WHERE total_invites > 0 
            ORDER BY total_invites DESC 
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    // Add bonus invites (admin command)
    async addBonusInvites(userId, amount) {
        return await this.updateUserInvites(userId, 0, amount, 0, 0);
    }
}

module.exports = InviteTracker;