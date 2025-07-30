const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { supabase } = require('./supabaseClient.js');

// Supabase-backed invite tracker
class SupabaseInviteTracker {
    constructor(client) {
        this.client = client;
        this.guildInvites = new Map();
    }

    async init() {
        console.log('🔄 Initializing Supabase invite tracker...');
        
        try {
            // Test Supabase connection
            const { data, error } = await supabase.from('users').select('count').limit(1);
            if (error && error.code !== 'PGRST116') {
                console.log('⚠️ Supabase tables need to be created manually - see SUPABASE_SETUP.md');
            } else {
                console.log('✅ Supabase connection verified');
            }
            
            // Cache invites for all guilds
            for (const guild of this.client.guilds.cache.values()) {
                await this.cacheGuildInvites(guild);
            }
            
            console.log('✅ Supabase invite tracker initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing invite tracker:', error);
        }
    }

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

    async getUser(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (data && !error) {
                return data;
            }
            
            // Create default user if not found
            const defaultUser = {
                user_id: userId,
                username: 'Unknown',
                total_invites: 0,
                joins: 0,
                bonus: 0,
                leaves: 0,
                fake: 0
            };
            
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert(defaultUser)
                .select()
                .single();
            
            return newUser || defaultUser;
        } catch (error) {
            console.error('❌ Error getting user:', error);
            return { user_id: userId, username: 'Unknown', total_invites: 0, joins: 0, bonus: 0, leaves: 0, fake: 0 };
        }
    }

    async createUser(userId, username, displayName, accountAge) {
        try {
            console.log(`📝 Creating user record for ${username} (${userId})`);
            
            const { data, error } = await supabase
                .from('users')
                .insert({
                    user_id: userId,
                    username: username,
                    display_name: displayName,
                    joins: 0,
                    bonus: 0,
                    leaves: 0,
                    fake: 0,
                    total_invites: 0
                })
                .select()
                .single();
            
            return data;
        } catch (error) {
            console.error('❌ Error creating user:', error);
            return await this.getUser(userId);
        }
    }

    async updateUserInvites(userId, joins = 0, bonus = 0, leaves = 0, fake = 0) {
        try {
            console.log(`📊 Updating invites for ${userId}: +${joins} joins, +${bonus} bonus, +${leaves} leaves, +${fake} fake`);
            
            // Get current user data
            const user = await this.getUser(userId);
            
            // Calculate new values
            const newJoins = user.joins + joins;
            const newBonus = user.bonus + bonus;
            const newLeaves = user.leaves + leaves;
            const newFake = user.fake + fake;
            const newTotal = newJoins + newBonus - newLeaves - newFake;
            
            // Update in Supabase
            const { data, error } = await supabase
                .from('users')
                .update({
                    joins: newJoins,
                    bonus: newBonus,
                    leaves: newLeaves,
                    fake: newFake,
                    total_invites: newTotal
                })
                .eq('user_id', userId)
                .select()
                .single();
            
            console.log(`✅ User ${userId} now has ${newTotal} total invites (${newJoins} joins + ${newBonus} bonus - ${newLeaves} leaves - ${newFake} fake)`);
            
            return data;
        } catch (error) {
            console.error('❌ Error updating user invites:', error);
            return await this.getUser(userId);
        }
    }
}
require('dotenv').config();

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMembers  // Required for member join/leave events
    ]
});

const inviteTracker = new SupabaseInviteTracker(client);

// Configuration
const config = {
    requiredRoleId: '1398018785461538878', // Role required to claim rewards
    verifiedRoleId: '1398018753542881520', // Verified role required in thread
    workflowTimeout: 600000, // 10 minutes
    threadTimeout: 300000,   // 5 minutes
    claimsCategoryId: '1399823374921764904', // Category for reward claim channels
    adminUserId: '1203727094138675341' // @jannueducates user ID
};

// Track user claim channels (userId -> channelCount)
const userClaimChannels = new Map();

// Reward configuration with invite requirements and skip costs
const rewardConfig = {
    3: { required: 3, skipCost: 2 },
    6: { required: 6, skipCost: 3 },
    9: { required: 9, skipCost: 3 },
    12: { required: 12, skipCost: 4 }
};

// Permission checker functions - Updated to use invite count instead of roles
async function hasRequiredInvites(member, requiredCount = 1) {
    const user = await inviteTracker.getUser(member.user.id);
    return user ? user.total_invites >= requiredCount : false;
}

function hasVerifiedRole(member) {
    return member.roles.cache.has(config.verifiedRoleId);
}

async function canClaimReward(member) {
    return await hasRequiredInvites(member, 1);
}

function canVerifyInThread(member) {
    return hasVerifiedRole(member);
}

// Embed creation functions
function createRewardEmbed(title, description, initiator) {
    return new EmbedBuilder()
        .setTitle(`🎁 ${title || 'Claim Your FREE Reward!'}`)
        .setDescription(`To celebrate reaching a great amount of **Robloxians**, Robux Giveaways is giving away **FREE reward** to one lucky member of this server!\n\n## **HOW IT WORKS**\n\n> **1.** Select ANY Prize you would like to claim.\n> **2.** Visit the Verification Site\n> **3.** Complete The Steps & Claim your **reward**!\n\n**NOTE:**\nThis is Offer Ends in **30 Days**. Make sure to Enter Now`)
        .setColor(0x5865F2) // Discord blue color
        .setFooter({ text: 'Choose Your Giveaway...' })
        .setTimestamp();
}

function createInviteCheckEmbed(title, description, initiator) {
    return new EmbedBuilder()
        .setTitle(`📊 ${title || 'Track Invites'}`)
        .setDescription(`• Click the button **below** to check your invites.\n• For your **invites** to count, your friends must join and stay in the **server**.`)
        .setColor(0x5865F2) // Discord blue color
        .setFooter({ text: 'Click the button below to check your invites' })
        .setTimestamp();
}

function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setColor(0x00FF00)
        .setFooter({ text: 'Workflow completed successfully' })
        .setTimestamp();
}

function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setColor(0xFF0000)
        .setFooter({ text: 'If this error persists, contact an administrator' })
        .setTimestamp();
}

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Bot is in ${client.guilds.cache.size} guilds`);
    
    // Initialize invite tracker
    await inviteTracker.init();
    console.log('📈 Invite tracker initialized');
    
    // Set bot status
    client.user.setActivity('for reward claims', { type: 'WATCHING' });
    
    // Register slash commands
    const commands = [
        {
            name: 'claim-reward',
            description: 'Setup a reward claim system',
            options: [
                {
                    type: 7, // CHANNEL
                    name: 'channel',
                    description: 'The channel to send the reward claim embed to',
                    required: false
                },
                {
                    type: 3, // STRING
                    name: 'title',
                    description: 'Title for the reward',
                    required: false
                },
                {
                    type: 3, // STRING
                    name: 'description',
                    description: 'Description of the reward',
                    required: false
                }
            ]
        },
        {
            name: 'invite-check',
            description: 'Setup an invite checking system',
            options: [
                {
                    type: 7, // CHANNEL
                    name: 'channel',
                    description: 'The channel to send the invite check embed to',
                    required: false
                },
                {
                    type: 3, // STRING
                    name: 'title',
                    description: 'Title for the invite checker',
                    required: false
                },
                {
                    type: 3, // STRING
                    name: 'description',
                    description: 'Description for the invite checker',
                    required: false
                }
            ]
        },
        {
            name: 'reward-status',
            description: 'Check reward system status'
        },
        {
            name: 'invite-leaderboard',
            description: 'Show the invite leaderboard',
            options: [
                {
                    type: 4, // INTEGER
                    name: 'limit',
                    description: 'Number of users to show (default: 10)',
                    required: false
                }
            ]
        },
        {
            name: 'invites-add',
            description: 'Add invites to a user (Admin only)',
            options: [
                {
                    type: 6, // USER
                    name: 'user',
                    description: 'The user to give invites to',
                    required: true
                },
                {
                    type: 4, // INTEGER
                    name: 'amount',
                    description: 'Number of invites to add',
                    required: true
                }
            ]
        },
        {
            name: 'invites-remove',
            description: 'Remove invites from a user (Admin only)',
            options: [
                {
                    type: 6, // USER
                    name: 'user',
                    description: 'The user to remove invites from',
                    required: true
                },
                {
                    type: 4, // INTEGER
                    name: 'amount',
                    description: 'Number of invites to remove',
                    required: true
                }
            ]
        },
        {
            name: 'credit-invite',
            description: 'Credit a regular invite to a user (Admin only)',
            options: [
                {
                    type: 6, // USER
                    name: 'inviter',
                    description: 'The user who invited someone',
                    required: true
                },
                {
                    type: 6, // USER
                    name: 'invited',
                    description: 'The user who was invited',
                    required: true
                }
            ]
        }
    ];
    
    try {
        console.log('🔄 Registering slash commands...');
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;
    
    try {
        if (interaction.isCommand()) {
            await handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        const errorMessage = 'An error occurred while processing your request.';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `❌ ${errorMessage}`, flags: [4096] });
        } else {
            await interaction.reply({ content: `❌ ${errorMessage}`, flags: [4096] });
        }
    }
});

// Handle slash commands
async function handleSlashCommand(interaction) {
    const { commandName, options } = interaction;
    
    if (commandName === 'claim-reward') {
        const channel = options.getChannel('channel') || interaction.channel;
        const title = options.getString('title') || 'Claim Your FREE Reward!';
        const description = options.getString('description') || 'FREE reward giveaway for Robloxians!';
        
        // Check if user has admin permissions to setup rewards
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to setup reward claims.',
                flags: [4096]
            });
        }
        
        // Create embed with dropdown menu
        const embed = createRewardEmbed(title, description, interaction.member);
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_reward')
            .setPlaceholder('Choose your reward amount...')
            .addOptions([
                {
                    label: '3 Invites Reward',
                    description: 'Claim reward for 3 invites',
                    value: '3',
                    emoji: '🎁'
                },
                {
                    label: '6 Invites Reward',
                    description: 'Claim reward for 6 invites',
                    value: '6',
                    emoji: '🎁'
                },
                {
                    label: '9 Invites Reward',
                    description: 'Claim reward for 9 invites',
                    value: '9',
                    emoji: '🎁'
                },
                {
                    label: '12 Invites Reward',
                    description: 'Claim reward for 12 invites',
                    value: '12',
                    emoji: '🎁'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        try {
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({
                content: `✅ FREE reward giveaway setup in ${channel}`,
                flags: [4096]
            });
            console.log(`Reward claim setup by ${interaction.user.tag} in ${channel.name}`);
        } catch (error) {
            await interaction.reply({
                content: '❌ I don\'t have permission to send messages to that channel.',
                flags: [4096]
            });
        }
    }
    
    else if (commandName === 'invite-check') {
        const channel = options.getChannel('channel') || interaction.channel;
        const title = options.getString('title') || 'Invite Status Checker';
        const description = options.getString('description') || 'Check your current invite count and eligibility status. Your results will be shown privately to you only.';
        
        // Check if user has admin permissions to setup invite checker
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to setup invite checkers.',
                flags: [4096]
            });
        }
        
        // Create embed and button
        const embed = createInviteCheckEmbed(title, description, interaction.member);
        const button = new ButtonBuilder()
            .setCustomId('check_invites')
            .setLabel('Check Invites')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️');
        
        const row = new ActionRowBuilder().addComponents(button);
        
        try {
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({
                content: `✅ Invite checker setup in ${channel}`,
                flags: [4096]
            });
            console.log(`Invite checker setup by ${interaction.user.tag} in ${channel.name}`);
        } catch (error) {
            await interaction.reply({
                content: '❌ I don\'t have permission to send messages to that channel.',
                flags: [4096]
            });
        }
    }
    
    else if (commandName === 'reward-status') {
        const embed = new EmbedBuilder()
            .setTitle('📊 Reward System Status')
            .setColor(0xFFD700)
            .addFields(
                { name: 'Bot Status', value: '🟢 Online and Ready', inline: true },
                { name: 'Server', value: interaction.guild.name, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.member.displayName}` })
            .setTimestamp();
        
        // Check bot permissions
        const botMember = interaction.guild.members.me;
        const permissions = botMember.permissions;
        
        const permStatus = [];
        permStatus.push(permissions.has(PermissionFlagsBits.ManageChannels) ? '✅ Manage Channels' : '❌ Manage Channels');
        permStatus.push(permissions.has(PermissionFlagsBits.ManageThreads) ? '✅ Manage Threads' : '❌ Manage Threads');
        permStatus.push(permissions.has(PermissionFlagsBits.CreatePrivateThreads) ? '✅ Create Private Threads' : '❌ Create Private Threads');
        
        embed.addFields({ name: 'Bot Permissions', value: permStatus.join('\n'), inline: false });
        
        await interaction.reply({ embeds: [embed], flags: [4096] });
    }
    
    else if (commandName === 'invite-leaderboard') {
        const limit = options.getInteger('limit') || 10;
        
        try {
            const leaderboard = await inviteTracker.getLeaderboard(interaction.guild.id, limit);
            
            if (leaderboard.length === 0) {
                return await interaction.reply({
                    content: '❌ No invite data found yet.',
                    flags: [4096]
                });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🏆 Invite Leaderboard')
                .setDescription(`Top ${leaderboard.length} members by invite count`)
                .setColor(0x5865F2)
                .setTimestamp();
            
            const leaderboardText = leaderboard.map((user, index) => {
                const position = index + 1;
                const medal = position <= 3 ? ['🥇', '🥈', '🥉'][position - 1] : `#${position}`;
                return `${medal} **${user.username}** - ${user.total_invites} invites (${user.regular_invites} regular)`;
            }).join('\n');
            
            embed.setDescription(`Top ${leaderboard.length} members by invite count\n\n${leaderboardText}`);
            
            await interaction.reply({ embeds: [embed], flags: [4096] });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.reply({
                content: '❌ Failed to fetch invite leaderboard.',
                flags: [4096]
            });
        }
    }
    
    else if (commandName === 'invites-add') {
        // Check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to add invites.',
                flags: [4096]
            });
        }
        
        const targetUser = options.getUser('user');
        const amount = options.getInteger('amount');
        
        if (amount <= 0) {
            return await interaction.reply({
                content: '❌ Amount must be a positive number.',
                flags: [4096]
            });
        }
        
        try {
            // Ensure user exists in database
            let user = await inviteTracker.getUser(targetUser.id);
            if (!user) {
                user = await inviteTracker.createUser(targetUser.id, targetUser.username, targetUser.displayName, targetUser.createdAt);
            }
            
            // Add invites
            const updatedUser = await inviteTracker.addBonusInvites(targetUser.id, amount);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Invites Added')
                .setDescription(`Successfully added **${amount}** invites to ${targetUser}`)
                .setColor(0x00FF00)
                .addFields([
                    { name: 'User', value: `${targetUser}`, inline: true },
                    { name: 'Invites Added', value: `${amount}`, inline: true },
                    { name: 'New Total', value: `${updatedUser.total_invites} invites`, inline: true }
                ])
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: [4096] });
            
            console.log(`Invites added: ${amount} to ${targetUser.tag} (by ${interaction.user.tag})`);
        } catch (error) {
            console.error('Error adding invites:', error);
            await interaction.reply({
                content: '❌ Failed to add invites.',
                flags: [4096]
            });
        }
    }
    
    else if (commandName === 'invites-remove') {
        // Check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to remove invites.',
                flags: [4096]
            });
        }
        
        const targetUser = options.getUser('user');
        const amount = options.getInteger('amount');
        
        if (amount <= 0) {
            return await interaction.reply({
                content: '❌ Amount must be a positive number.',
                flags: [4096]
            });
        }
        
        try {
            // Ensure user exists in database
            let user = await inviteTracker.getUser(targetUser.id);
            if (!user) {
                return await interaction.reply({
                    content: '❌ User not found in the database.',
                    flags: [4096]
                });
            }
            
            if (user.total_invites < amount) {
                return await interaction.reply({
                    content: `❌ User only has **${user.total_invites}** invites. Cannot remove **${amount}**.`,
                    flags: [4096]
                });
            }
            
            // Remove invites
            const updatedUser = await inviteTracker.removeInvites(targetUser.id, amount);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Invites Removed')
                .setDescription(`Successfully removed **${amount}** invites from ${targetUser}`)
                .setColor(0xFF6B6B)
                .addFields([
                    { name: 'User', value: `${targetUser}`, inline: true },
                    { name: 'Invites Removed', value: `${amount}`, inline: true },
                    { name: 'New Total', value: `${updatedUser.total_invites} invites`, inline: true }
                ])
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: [4096] });
            
            console.log(`Invites removed: ${amount} from ${targetUser.tag} (by ${interaction.user.tag})`);
        } catch (error) {
            console.error('Error removing invites:', error);
            await interaction.reply({
                content: '❌ Failed to remove invites.',
                flags: [4096]
            });
        }
    }
    
    else if (commandName === 'credit-invite') {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to credit invites.',
                flags: [4096]
            });
        }
        
        const inviterUser = options.getUser('inviter');
        const invitedUser = options.getUser('invited');
        
        if (inviterUser.id === invitedUser.id) {
            return await interaction.reply({
                content: '❌ A user cannot invite themselves.',
                flags: [4096]
            });
        }
        
        try {
            // Ensure inviter exists in database
            let inviter = await inviteTracker.getUser(inviterUser.id);
            if (!inviter) {
                inviter = await inviteTracker.createUser(inviterUser.id, inviterUser.username, inviterUser.displayName, inviterUser.createdAt);
            }
            
            // Ensure invited user exists in database
            let invited = await inviteTracker.getUser(invitedUser.id);
            if (!invited) {
                invited = await inviteTracker.createUser(invitedUser.id, invitedUser.username, invitedUser.displayName, invitedUser.createdAt);
            }
            
            // Add invite record
            await inviteTracker.addInvite(inviterUser.id, invitedUser.id, invitedUser.username, 'manual');
            
            // Add regular invite
            const updatedInviter = await inviteTracker.updateUserInvites(inviterUser.id, 1, 0, 0, 0);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Invite Credited')
                .setDescription(`Successfully credited 1 invite to ${inviterUser} for inviting ${invitedUser}`)
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Inviter', value: `${inviterUser}`, inline: true },
                    { name: 'Invited User', value: `${invitedUser}`, inline: true },
                    { name: 'New Total', value: `${updatedInviter.total_invites} invites`, inline: true }
                ])
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: [4096] });
            
            // Check for role rewards after crediting invite
            await inviteTracker.checkRoleRewards(interaction.guild, inviterUser.id);
            
            console.log(`Manual invite credited: ${inviterUser.tag} invited ${invitedUser.tag} (by ${interaction.user.tag})`);
        } catch (error) {
            console.error('Error crediting invite:', error);
            await interaction.reply({
                content: '❌ Failed to credit invite.',
                flags: [4096]
            });
        }
    }
}

// Handle select menu interactions
async function handleSelectMenuInteraction(interaction) {
    console.log(`Select menu interaction: ${interaction.customId} by ${interaction.user.tag}`);

    if (interaction.customId === 'select_reward') {
        const selectedValue = parseInt(interaction.values[0]);
        const rewardInfo = rewardConfig[selectedValue];
        
        if (!rewardInfo) {
            return await interaction.reply({
                content: '❌ Invalid reward selection.',
                flags: [4096]
            });
        }

        // Check if user has enough invites
        const user = await inviteTracker.getUser(interaction.user.id);
        const userInvites = user ? user.total_invites : 0;

        if (userInvites < rewardInfo.required) {
            return await interaction.reply({
                content: `❌ You need **${rewardInfo.required} invites** to claim this reward. You currently have **${userInvites} invites**.`,
                flags: [4096]
            });
        }

        // Check if user already has 1 active thread
        const userChannelCount = userClaimChannels.get(interaction.user.id) || 0;
        if (userChannelCount >= 1) {
            return await interaction.reply({
                content: '❌ You already have an active claim thread. Please close it before creating another.',
                flags: [4096]
            });
        }

        try {
            // Create private thread instead of channel
            const threadName = `🎁-${interaction.user.username}-${selectedValue}inv-claim`;
            
            const claimThread = await interaction.channel.threads.create({
                name: threadName,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Private claim thread for ${interaction.user.tag} - ${selectedValue} invites reward`
            });

            // Add user to the private thread
            await claimThread.members.add(interaction.user.id);

            // Update user thread count
            userClaimChannels.set(interaction.user.id, userChannelCount + 1);

            // Create queue embed and buttons
            const queueEmbed = new EmbedBuilder()
                .setTitle('🎁 Reward Claim Queue')
                .setDescription(`**${interaction.user.username}**, you are currently in the queue for your **${selectedValue} invites reward**.

**Queue Skip Option:**
To skip the queue, you need **${rewardInfo.skipCost} additional invites** (total: ${rewardInfo.required + rewardInfo.skipCost} invites).

**Current Status:** Ready for Processing
**Required Invites:** ${rewardInfo.required}
**Your Invites:** ${userInvites}`)
                .setColor(0x5865F2)
                .setTimestamp();

            const skipButton = new ButtonBuilder()
                .setCustomId(`skip_queue_${selectedValue}`)
                .setLabel(`Skip Queue (+${rewardInfo.skipCost} invites)`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚡');

            const processButton = new ButtonBuilder()
                .setCustomId(`continue_claim_${selectedValue}`)
                .setLabel('Ready for Processing')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎁');

            const closeButton = new ButtonBuilder()
                .setCustomId('close_channel')
                .setLabel('Close Thread')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');

            const buttonRow = new ActionRowBuilder().addComponents(skipButton, processButton, closeButton);

            await claimThread.send({
                content: `${interaction.user}`,
                embeds: [queueEmbed],
                components: [buttonRow]
            });

            await interaction.reply({
                content: `✅ Private claim thread created: ${claimThread}`,
                flags: [4096]
            });

        } catch (error) {
            console.error('Error creating claim thread:', error);
            await interaction.reply({
                content: '❌ Failed to create claim thread. Please try again.',
                flags: [4096]
            });
        }
    }
}

// Handle button interactions
async function handleButtonInteraction(interaction) {
    const { customId } = interaction;
    
    if (customId === 'claim_reward') {
        // Check if user has required invites to claim rewards
        const userCanClaim = await canClaimReward(interaction.member);
        if (!userCanClaim) {
            return await interaction.reply({
                content: `❌ You need at least 1 invite to claim rewards. Invite friends to this server and try again.`,
                flags: [4096]
            });
        }
        
        // Create private thread
        const threadName = `🎁-robux-giveaway-${interaction.member.displayName}`;
        
        try {
            const thread = await interaction.channel.threads.create({
                name: threadName,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Private Robux giveaway verification for ${interaction.user.tag}`
            });
            
            // Add only the user to the private thread
            await thread.members.add(interaction.user.id);
            
            // Create welcome embed for private thread
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`You're almost there!`)
                .setDescription(`# **To Get Access To The Giveaway:**\n\n> **1.** Go to This Website & Select Your Prize!\n> **2.** Enter your Username & click on continue.\n> **3.** Once done confirming complete ANY TWO steps given below!\n\nOnce done, you will get access to the Reward Giveaway\n\n**NOTE:**\nIssues completing the Verification? Get 2 Invites to bypass the Verification!`)
                .setColor(0x5865F2)
                .setTimestamp();
            
            // Create verification and bypass buttons
            const verifyButton = new ButtonBuilder()
                .setCustomId(`start_verification_${interaction.user.id}`)
                .setLabel('Start Verification')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔗');
            
            const bypassButton = new ButtonBuilder()
                .setCustomId(`check_bypass_${interaction.user.id}`)
                .setLabel('Check Invite Bypass')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚡');
            
            const verifyRow = new ActionRowBuilder().addComponents(verifyButton, bypassButton);
            
            await thread.send({ embeds: [welcomeEmbed], components: [verifyRow] });
            
            await interaction.reply({
                content: `✅ Private thread created. Check your private thread to continue.`,
                flags: [4096]
            });
            
            console.log(`Private reward claim thread created by ${interaction.user.tag} in ${interaction.guild.name}`);
            
        } catch (error) {
            console.error('Error creating private thread:', error);
            await interaction.reply({
                content: '❌ I don\'t have permission to create private threads in this channel.',
                flags: [4096]
            });
        }
    }
    
    else if (customId === 'check_invites') {
        // Get user's actual invite count from database
        const user = await inviteTracker.getUser(interaction.user.id);
        const totalInvites = user ? user.total_invites : 0;
        const regularInvites = user ? user.regular_invites : 0;
        const bonusInvites = user ? user.bonus_invites : 0;
        const leftInvites = user ? user.left_invites : 0;
        const fakeInvites = user ? user.fake_invites : 0;
        
        const statusEmbed = new EmbedBuilder()
            .setTitle('📊 Your Invite Count')
            .setDescription(`You currently have **${totalInvites}** ${totalInvites === 1 ? 'invite' : 'invites'}.`)
            .setColor(0x5865F2)
            .setTimestamp();
        
        // Send private response
        await interaction.reply({
            embeds: [statusEmbed],
            flags: [4096]
        });
        
        console.log(`Invite check performed by ${interaction.user.tag}: ${totalInvites} invite(s)`);
    }
    
    else if (customId.startsWith('start_verification_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the reward claimer can start verification.',
                flags: [4096]
            });
        }
        
        // Send verification link
        const verificationEmbed = new EmbedBuilder()
            .setTitle('🔗 Verification Required')
            .setDescription('Click the link below to start your verification process:\n\n**[Start Verification Process](https://free-content.pro/s?SGMoBfwM)**\n\nOnce you complete the verification, you will automatically get access to the reward giveaway!')
            .setColor(0x5865F2)
            .setTimestamp();
        
        await interaction.reply({
            embeds: [verificationEmbed],
            flags: [4096]
        });
        
        console.log(`Verification link sent to ${interaction.user.tag}`);
    }
    
    else if (customId.startsWith('check_bypass_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the reward claimer can check bypass eligibility.',
                flags: [4096]
            });
        }
        
        // Check if user has enough invites to bypass verification
        const user = await inviteTracker.getUser(interaction.user.id);
        const inviteCount = user ? user.total_invites : 0;
        const requiredInvites = 2;
        
        const bypassEmbed = new EmbedBuilder()
            .setTitle('⚡ Invite Bypass Check')
            .setColor(inviteCount >= requiredInvites ? 0x00FF00 : 0xFF6B6B);
        
        if (inviteCount >= requiredInvites) {
            bypassEmbed.setDescription(`✅ **Bypass Available!**\n\nYou have **${inviteCount}** invites and can bypass verification!\n\nYou now have access to the reward giveaway without completing verification.`);
            
            // Create final claim button for bypass users
            const bypassClaimButton = new ButtonBuilder()
                .setCustomId(`final_claim_${interaction.user.id}`)
                .setLabel('Claim My Reward')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🏆');
            
            const bypassRow = new ActionRowBuilder().addComponents(bypassClaimButton);
            
            await interaction.reply({
                embeds: [bypassEmbed],
                components: [bypassRow],
                flags: [4096]
            });
        } else {
            bypassEmbed.setDescription(`❌ **Bypass Not Available**\n\nYou have **${inviteCount}** invites but need **${requiredInvites}** invites to bypass verification.\n\nPlease complete the verification process or get more invites.`);
            
            await interaction.reply({
                embeds: [bypassEmbed],
                flags: [4096]
            });
        }
        
        console.log(`Bypass check performed by ${interaction.user.tag}: ${inviteCount}/${requiredInvites} invites`);
    }
    
    else if (customId.startsWith('verify_claim_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the reward claimer can complete verification.',
                flags: [4096]
            });
        }
        
        // Check if user has verified role
        if (!canVerifyInThread(interaction.member)) {
            const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);
            const roleName = verifiedRole ? verifiedRole.name : 'Verified Role';
            
            return await interaction.reply({
                content: `❌ You need the **${roleName}** role to complete verification. Please get verified first and try again.`,
                flags: [4096]
            });
        }
        
        // Verification successful, proceed to reward claim
        const embed = new EmbedBuilder()
            .setTitle('✅ Verification Complete')
            .setDescription(`Congratulations! Your verification is complete.`)
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '📋 Status Check',
                    value: '✅ Required role: Verified\n✅ Verification status: Complete\n✅ Ready to claim reward',
                    inline: false
                },
                {
                    name: 'Final Step',
                    value: 'Click \'Claim My Reward\' to receive your exclusive reward channel.',
                    inline: false
                }
            )
            .setTimestamp();
        
        // Create final claim button
        const claimButton = new ButtonBuilder()
            .setCustomId(`final_claim_${interaction.user.id}`)
            .setLabel('Claim My Reward')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🏆');
        
        const finalRow = new ActionRowBuilder().addComponents(claimButton);
        
        await interaction.update({ embeds: [embed], components: [finalRow] });
        
        console.log(`Verification completed for reward claim by ${interaction.user.tag}`);
    }
    
    else if (customId.startsWith('cancel_claim_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the reward claimer can cancel this claim.',
                flags: [4096]
            });
        }
        
        const embed = createErrorEmbed(
            'Reward Claim Cancelled',
            'The reward claim has been cancelled by the user.'
        );
        
        await interaction.update({ embeds: [embed], components: [] });
        
        // Archive the thread
        if (interaction.channel.isThread()) {
            setTimeout(async () => {
                try {
                    await interaction.channel.setArchived(true);
                } catch (error) {
                    console.error('Error archiving thread:', error);
                }
            }, 5000);
        }
        
        console.log(`Reward claim cancelled by ${interaction.user.tag}`);
    }
    
    else if (customId.startsWith('final_claim_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the reward claimer can claim the final reward.',
                flags: [4096]
            });
        }
        
        // Create reward channel
        const channelName = `🏆-reward-${interaction.member.displayName}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        
        try {
            // Set up channel permissions - private to user and admins only
            const overwrites = [
                {
                    id: interaction.guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageMessages
                    ]
                }
            ];
            
            // Add admins to the reward channel
            const adminMembers = interaction.guild.members.cache.filter(member => 
                member.permissions.has(PermissionFlagsBits.Administrator)
            );
            
            adminMembers.forEach(member => {
                if (member.id !== interaction.user.id) { // Don't duplicate user permissions
                    overwrites.push({
                        id: member.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    });
                }
            });
            
            const rewardChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: overwrites,
                reason: `Exclusive reward channel for ${interaction.user.tag}`
            });
            
            // Send success message in thread
            const successEmbed = createSuccessEmbed(
                'Reward Claimed Successfully!',
                `🎉 Congratulations! Your exclusive reward has been claimed.\n\n` +
                `**Reward Channel:** ${rewardChannel}\n` +
                `**Claimed by:** ${interaction.member}\n` +
                `**Claim Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
            );
            
            await interaction.update({ embeds: [successEmbed], components: [] });
            
            // Send welcome message to reward channel
            const rewardWelcomeEmbed = new EmbedBuilder()
                .setTitle('🏆 Congratulations on Your Exclusive Reward!')
                .setDescription(`Welcome to your exclusive reward channel, ${interaction.member}!\n\nThis private channel is your reward for completing the verification process and having the required invite.`)
                .setColor(0xFFD700)
                .addFields(
                    { name: '🎁 Reward Details', value: 'This is your exclusive private channel', inline: true },
                    { name: '👤 Claimed by', value: interaction.member.toString(), inline: true },
                    { name: '📅 Claimed on', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: '🔒 Privacy', value: 'This channel is private and only visible to you and server admins', inline: false }
                )
                .setThumbnail(interaction.member.displayAvatarURL())
                .setTimestamp();
            
            await rewardChannel.send({ embeds: [rewardWelcomeEmbed] });
            
            // Archive the claim thread
            if (interaction.channel.isThread()) {
                setTimeout(async () => {
                    try {
                        await interaction.channel.setArchived(true);
                    } catch (error) {
                        console.error('Error archiving thread:', error);
                    }
                }, 10000);
            }
            
            console.log(`Reward claimed by ${interaction.user.tag}, exclusive channel ${rewardChannel.name} created`);
            
        } catch (error) {
            console.error('Error creating reward channel:', error);
            await interaction.reply({
                content: '❌ I don\'t have permission to create channels in this server.',
                flags: [4096]
            });
        }
    }
    
    // Handle queue skip buttons
    else if (customId.startsWith('skip_queue_')) {
        const rewardAmount = parseInt(customId.split('_')[2]);
        const rewardInfo = rewardConfig[rewardAmount];
        const user = await inviteTracker.getUser(interaction.user.id);
        const userInvites = user ? user.total_invites : 0;
        const requiredForSkip = rewardInfo.required + rewardInfo.skipCost;

        if (userInvites >= requiredForSkip) {
            // Rename channel to quick-claims
            await interaction.channel.setName(`quick-claims-${interaction.user.username}`);
            
            // Ping admin and proceed
            const skipEmbed = new EmbedBuilder()
                .setTitle('⚡ Queue Skipped!')
                .setDescription(`**${interaction.user.username}** has skipped the queue with **${userInvites} invites**!

<@${config.adminUserId}> - Please process this quick claim.

**Reward Type:** ${rewardAmount} Invites Reward
**User Invites:** ${userInvites}
**Status:** Ready for Processing`)
                .setColor(0x00FF00)
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('close_channel')
                .setLabel('Close Channel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');

            const row = new ActionRowBuilder().addComponents(closeButton);

            await interaction.update({
                embeds: [skipEmbed],
                components: [row]
            });

            console.log(`Queue skipped by ${interaction.user.tag} for ${rewardAmount} invites reward`);
        } else {
            await interaction.reply({
                content: `❌ You need **${requiredForSkip} invites** to skip the queue. You currently have **${userInvites} invites**.`,
                flags: [4096]
            });
        }
    }
    
    // Handle continue in queue button
    else if (customId.startsWith('continue_claim_')) {
        const rewardAmount = parseInt(customId.split('_')[2]);
        
        // Ping admin for regular queue processing
        const continueEmbed = new EmbedBuilder()
            .setTitle('⏳ Processing Claim')
            .setDescription(`**${interaction.user.username}** is ready to proceed with their claim.

<@${config.adminUserId}> - Please process this claim.

**Reward Type:** ${rewardAmount} Invites Reward
**Status:** In Queue - Ready for Processing`)
            .setColor(0x5865F2)
            .setTimestamp();

        const closeButton = new ButtonBuilder()
            .setCustomId('close_channel')
            .setLabel('Close Channel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const row = new ActionRowBuilder().addComponents(closeButton);

        await interaction.update({
            embeds: [continueEmbed],
            components: [row]
        });

        console.log(`Claim continued by ${interaction.user.tag} for ${rewardAmount} invites reward`);
    }
    
    // Handle close channel button
    else if (customId === 'close_channel') {
        try {
            // Decrease user thread count
            const currentCount = userClaimChannels.get(interaction.user.id) || 0;
            if (currentCount > 0) {
                userClaimChannels.set(interaction.user.id, currentCount - 1);
            }

            await interaction.reply({
                content: '🗑️ This thread will be archived in 5 seconds...',
                flags: [4096]
            });

            setTimeout(async () => {
                try {
                    if (interaction.channel.isThread()) {
                        await interaction.channel.setArchived(true);
                    } else {
                        await interaction.channel.delete();
                    }
                } catch (error) {
                    console.error('Error archiving/deleting thread:', error);
                }
            }, 5000);

            console.log(`Thread closed by ${interaction.user.tag}`);
        } catch (error) {
            console.error('Error closing thread:', error);
            await interaction.reply({
                content: '❌ Failed to close thread.',
                flags: [4096]
            });
        }
    }
}

// Member join event - track invites
client.on('guildMemberAdd', async member => {
    try {
        console.log(`👋 ${member.user.username} joined ${member.guild.name}`);
        
        // Get current invites
        const newInvites = await member.guild.invites.fetch();
        const oldInvites = inviteTracker.guildInvites.get(member.guild.id) || new Map();
        
        // Find which invite was used
        let usedInvite = null;
        for (const [code, invite] of newInvites) {
            const oldInvite = oldInvites.get(code);
            if (oldInvite && invite.uses > oldInvite.uses) {
                usedInvite = invite;
                break;
            }
        }
        
        if (usedInvite && usedInvite.inviter) {
            // Credit the inviter
            console.log(`📈 ${usedInvite.inviter.username} gets credit for inviting ${member.user.username}`);
            
            // Get or create inviter user data
            let inviter = await inviteTracker.getUser(usedInvite.inviter.id);
            if (!inviter) {
                inviter = await inviteTracker.createUser(
                    usedInvite.inviter.id,
                    usedInvite.inviter.username,
                    usedInvite.inviter.displayName || usedInvite.inviter.username,
                    usedInvite.inviter.createdAt
                );
            }
            
            // Add regular invite
            await inviteTracker.updateUserInvites(usedInvite.inviter.id, 1, 0, 0, 0);
            
            console.log(`✅ Credited 1 invite to ${usedInvite.inviter.username} for ${member.user.username} joining`);
        }
        
        // Update cached invites
        await inviteTracker.cacheGuildInvites(member.guild);
        
    } catch (error) {
        console.error('Error processing member join:', error);
    }
});

// Member leave event - handle leaves
client.on('guildMemberRemove', async member => {
    try {
        console.log(`👋 ${member.user.username} left ${member.guild.name}`);
        
        // Update cached invites
        await inviteTracker.cacheGuildInvites(member.guild);
        
    } catch (error) {
        console.error('Error processing member leave:', error);
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

client.login(token).catch(error => {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
});