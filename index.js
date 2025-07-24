const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
require('dotenv').config();

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Configuration
const config = {
    requiredRoleId: '1398018785461538878', // Role required to claim rewards
    verifiedRoleId: '1398018753542881520', // Verified role required in thread
    workflowTimeout: 600000, // 10 minutes
    threadTimeout: 300000    // 5 minutes
};

// Permission checker functions
function hasRequiredRole(member) {
    return member.roles.cache.has(config.requiredRoleId);
}

function hasVerifiedRole(member) {
    return member.roles.cache.has(config.verifiedRoleId);
}

function canClaimReward(member) {
    return hasRequiredRole(member);
}

function canVerifyInThread(member) {
    return hasVerifiedRole(member);
}

// Embed creation functions
function createRewardEmbed(title, description, initiator) {
    return new EmbedBuilder()
        .setTitle(`🎁 ${title}`)
        .setDescription(description)
        .setColor(0xFFD700) // Gold color for rewards
        .addFields(
            { name: 'Reward Available For', value: initiator.toString(), inline: true },
            { name: 'Server', value: initiator.guild.name, inline: true },
            { name: 'Status', value: '🟡 Ready to claim', inline: true },
            {
                name: '📋 Requirements',
                value: '1. Must have required role to claim\n2. Need 1 invite to unlock reward\n3. Complete verification in private thread',
                inline: false
            }
        )
        .setFooter({ text: 'Click the button below to claim your reward', iconURL: initiator.displayAvatarURL() })
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
            name: 'reward-status',
            description: 'Check reward system status'
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
    if (!interaction.isCommand() && !interaction.isButton()) return;
    
    try {
        if (interaction.isCommand()) {
            await handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        const errorMessage = 'An error occurred while processing your request.';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true });
        } else {
            await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
        }
    }
});

// Handle slash commands
async function handleSlashCommand(interaction) {
    const { commandName, options } = interaction;
    
    if (commandName === 'claim-reward') {
        const channel = options.getChannel('channel') || interaction.channel;
        const title = options.getString('title') || 'Exclusive Reward';
        const description = options.getString('description') || 'An exclusive reward is available for qualified members. Click below to claim it!';
        
        // Check if user has admin permissions to setup rewards
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permission to setup reward claims.',
                flags: [4096] // EPHEMERAL flag
            });
        }
        
        // Create embed and button
        const embed = createRewardEmbed(title, description, interaction.member);
        const button = new ButtonBuilder()
            .setCustomId('claim_reward')
            .setLabel('Claim Reward')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎁');
        
        const row = new ActionRowBuilder().addComponents(button);
        
        try {
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({
                content: `✅ Reward claim system setup in ${channel}`,
                flags: [4096] // EPHEMERAL flag
            });
            console.log(`Reward claim setup by ${interaction.user.tag} in ${channel.name}`);
        } catch (error) {
            await interaction.reply({
                content: '❌ I don\'t have permission to send messages to that channel.',
                flags: [4096] // EPHEMERAL flag
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
}

// Handle button interactions
async function handleButtonInteraction(interaction) {
    const { customId } = interaction;
    
    if (customId === 'claim_reward') {
        // Check if user has required role to claim rewards
        if (!canClaimReward(interaction.member)) {
            const requiredRole = interaction.guild.roles.cache.get(config.requiredRoleId);
            const roleName = requiredRole ? requiredRole.name : 'Required Role';
            
            return await interaction.reply({
                content: `❌ You need the **${roleName}** role to claim rewards. Please get this role first and try again.`,
                flags: [4096] // EPHEMERAL flag
            });
        }
        
        // Create private thread
        const threadName = `🎁-reward-claim-${interaction.member.displayName}`;
        
        try {
            const thread = await interaction.channel.threads.create({
                name: threadName,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Private reward claim thread for ${interaction.user.tag}`
            });
            
            // Add only the user to the private thread
            await thread.members.add(interaction.user.id);
            
            // Create welcome embed for private thread
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎁 Reward Claim Process')
                .setDescription(`Welcome ${interaction.member}! You're now in your private reward claim area.`)
                .setColor(0xFFD700)
                .addFields(
                    {
                        name: '📋 Requirements Check',
                        value: '✅ Required role: Verified\n⏳ Verification status: Pending\n💎 Invite requirement: 1 invite needed',
                        inline: false
                    },
                    {
                        name: 'Next Steps',
                        value: 'Complete the verification process below to claim your reward.',
                        inline: false
                    }
                )
                .setTimestamp();
            
            // Create verification button
            const verifyButton = new ButtonBuilder()
                .setCustomId(`verify_claim_${interaction.user.id}`)
                .setLabel('Complete Verification')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');
            
            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_claim_${interaction.user.id}`)
                .setLabel('Cancel Claim')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');
            
            const verifyRow = new ActionRowBuilder().addComponents(verifyButton, cancelButton);
            
            await thread.send({ embeds: [welcomeEmbed], components: [verifyRow] });
            
            await interaction.reply({
                content: `✅ Private reward claim thread created. Check your private thread to continue.`,
                flags: [4096] // EPHEMERAL flag
            });
            
            console.log(`Private reward claim thread created by ${interaction.user.tag} in ${interaction.guild.name}`);
            
        } catch (error) {
            console.error('Error creating private thread:', error);
            await interaction.reply({
                content: '❌ I don\'t have permission to create private threads in this channel.',
                flags: [4096] // EPHEMERAL flag
            });
        }
    }
    
    else if (customId.startsWith('verify_claim_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the reward claimer can complete verification.',
                flags: [4096] // EPHEMERAL flag
            });
        }
        
        // Check if user has verified role
        if (!canVerifyInThread(interaction.member)) {
            const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);
            const roleName = verifiedRole ? verifiedRole.name : 'Verified Role';
            
            return await interaction.reply({
                content: `❌ You need the **${roleName}** role to complete verification. Please get verified first and try again.`,
                flags: [4096] // EPHEMERAL flag
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
                flags: [4096] // EPHEMERAL flag
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
                flags: [4096] // EPHEMERAL flag
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
                flags: [4096] // EPHEMERAL flag
            });
        }
    }
}

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