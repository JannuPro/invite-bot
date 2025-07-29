const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const SimplifiedInviteTracker = require('./simplifiedInviteTracker.js');
require('dotenv').config();

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const inviteTracker = new SimplifiedInviteTracker(client);

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
            name: 'add-bonus-invites',
            description: 'Add bonus invites to a user (Admin only)',
            options: [
                {
                    type: 6, // USER
                    name: 'user',
                    description: 'The user to give bonus invites to',
                    required: true
                },
                {
                    type: 4, // INTEGER
                    name: 'amount',
                    description: 'Number of bonus invites to add',
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
    
    else if (commandName === 'add-bonus-invites') {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to add bonus invites.',
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
            
            // Add bonus invites
            const updatedUser = await inviteTracker.addBonusInvites(targetUser.id, amount);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Bonus Invites Added')
                .setDescription(`Successfully added **${amount}** bonus invites to ${targetUser}`)
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Previous Total', value: `${updatedUser.total_invites - amount}`, inline: true },
                    { name: 'Bonus Added', value: `${amount}`, inline: true },
                    { name: 'New Total', value: `${updatedUser.total_invites}`, inline: true }
                ])
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], flags: [4096] });
            
            // Check for role rewards after adding bonus invites
            await inviteTracker.checkRoleRewards(interaction.guild, targetUser.id);
            
            console.log(`${amount} bonus invites added to ${targetUser.tag} by ${interaction.user.tag}`);
        } catch (error) {
            console.error('Error adding bonus invites:', error);
            await interaction.reply({
                content: '❌ Failed to add bonus invites.',
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
                ephemeral: true
            });
        }

        // Check if user has enough invites
        const user = await inviteTracker.getUser(interaction.user.id);
        const userInvites = user ? user.total_invites : 0;

        if (userInvites < rewardInfo.required) {
            return await interaction.reply({
                content: `❌ You need **${rewardInfo.required} invites** to claim this reward. You currently have **${userInvites} invites**.`,
                ephemeral: true
            });
        }

        // Check if user already has 2 active channels
        const userChannelCount = userClaimChannels.get(interaction.user.id) || 0;
        if (userChannelCount >= 2) {
            return await interaction.reply({
                content: '❌ You can only have **2 active claim channels** at a time. Please close an existing channel first.',
                ephemeral: true
            });
        }

        try {
            // Create private channel in the claims category
            const category = interaction.guild.channels.cache.get(config.claimsCategoryId);
            if (!category) {
                return await interaction.reply({
                    content: '❌ Claims category not found. Please contact an administrator.',
                    ephemeral: true
                });
            }

            const channelName = `${interaction.user.username}-${selectedValue}-invites`;
            const claimChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: config.adminUserId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            // Update user channel count
            userClaimChannels.set(interaction.user.id, userChannelCount + 1);

            // Create queue embed and buttons
            const queueEmbed = new EmbedBuilder()
                .setTitle('🎁 Reward Claim Queue')
                .setDescription(`**${interaction.user.username}**, you are currently in the queue for your **${selectedValue} invites reward**.

**Queue Skip Option:**
To skip the queue, you need **${rewardInfo.skipCost} additional invites** (total: ${rewardInfo.required + rewardInfo.skipCost} invites).

**Current Status:** In Queue
**Required Invites:** ${rewardInfo.required}
**Your Invites:** ${userInvites}`)
                .setColor(0x5865F2)
                .setTimestamp();

            const skipButton = new ButtonBuilder()
                .setCustomId(`skip_queue_${selectedValue}`)
                .setLabel(`Skip Queue (+${rewardInfo.skipCost} invites)`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚡');

            const continueButton = new ButtonBuilder()
                .setCustomId(`continue_claim_${selectedValue}`)
                .setLabel('Continue in Queue')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏳');

            const closeButton = new ButtonBuilder()
                .setCustomId('close_channel')
                .setLabel('Close Channel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');

            const buttonRow = new ActionRowBuilder().addComponents(skipButton, continueButton, closeButton);

            await claimChannel.send({
                content: `${interaction.user}`,
                embeds: [queueEmbed],
                components: [buttonRow]
            });

            await interaction.reply({
                content: `✅ Private claim channel created: ${claimChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating claim channel:', error);
            await interaction.reply({
                content: '❌ Failed to create claim channel. Please try again.',
                ephemeral: true
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
            .setDescription(`You currently have **${totalInvites}** ${totalInvites === 1 ? 'invite' : 'invites'}. (${regularInvites} regular)`)
            .setColor(0x5865F2)
            .addFields([
                { name: '✅ Regular Invites', value: `${regularInvites}`, inline: true },
                { name: '🎁 Bonus Invites', value: `${bonusInvites}`, inline: true },
                { name: '📊 Total Invites', value: `${totalInvites}`, inline: true }
            ])
            .setTimestamp();

        if (leftInvites > 0 || fakeInvites > 0) {
            statusEmbed.addFields([
                { name: '👋 Left Server', value: `${leftInvites}`, inline: true },
                { name: '❌ Invalid (New Account)', value: `${fakeInvites}`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }
            ]);
        }
        
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
                ephemeral: true
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
            // Decrease user channel count
            const currentCount = userClaimChannels.get(interaction.user.id) || 0;
            if (currentCount > 0) {
                userClaimChannels.set(interaction.user.id, currentCount - 1);
            }

            await interaction.reply({
                content: '🗑️ This channel will be deleted in 5 seconds...',
                ephemeral: true
            });

            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    console.error('Error deleting channel:', error);
                }
            }, 5000);

            console.log(`Channel closed by ${interaction.user.tag}`);
        } catch (error) {
            console.error('Error closing channel:', error);
            await interaction.reply({
                content: '❌ Failed to close channel.',
                ephemeral: true
            });
        }
    }
}

// Note: Member join/leave events disabled due to privileged intent requirements
// Use manual invite tracking with /credit-invite command instead

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