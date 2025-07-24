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
    adminRoles: ['Workflow Admin', 'Admin', 'Administrator'],
    managerRoles: ['Workflow Manager', 'Manager', 'Moderator', 'Staff'],
    userRoles: ['Workflow User', 'Member', 'Verified'],
    workflowTimeout: 600000, // 10 minutes
    threadTimeout: 300000    // 5 minutes
};

// Permission checker functions
function hasRole(member, roleNames) {
    return member.roles.cache.some(role => roleNames.includes(role.name));
}

function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || hasRole(member, config.adminRoles);
}

function isManager(member) {
    return isAdmin(member) || hasRole(member, config.managerRoles);
}

function isUser(member) {
    return hasRole(member, config.userRoles) || member.roles.cache.size > 1; // Has roles beyond @everyone
}

function canStartWorkflow(member) {
    return isManager(member) || isAdmin(member);
}

function canParticipate(member) {
    return isUser(member) || isManager(member) || isAdmin(member);
}

// Embed creation functions
function createWorkflowEmbed(title, description, initiator) {
    return new EmbedBuilder()
        .setTitle(`🔄 ${title}`)
        .setDescription(description)
        .setColor(0x0099FF)
        .addFields(
            { name: 'Initiated by', value: initiator.toString(), inline: true },
            { name: 'Server', value: initiator.guild.name, inline: true },
            { name: 'Status', value: '🟡 Waiting for interaction', inline: true },
            {
                name: '📋 Instructions',
                value: '1. Click **Start Process** to begin\n2. Complete verification in the created thread\n3. Channel will be created upon successful completion',
                inline: false
            }
        )
        .setFooter({ text: 'Click the buttons below to interact with this workflow', iconURL: initiator.displayAvatarURL() })
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
    client.user.setActivity('for workflow commands', { type: 'WATCHING' });
    
    // Register slash commands
    const commands = [
        {
            name: 'workflow',
            description: 'Start a role-based workflow process',
            options: [
                {
                    type: 7, // CHANNEL
                    name: 'channel',
                    description: 'The channel to send the workflow embed to',
                    required: false
                },
                {
                    type: 3, // STRING
                    name: 'title',
                    description: 'Title for the workflow embed',
                    required: false
                },
                {
                    type: 3, // STRING
                    name: 'description',
                    description: 'Description for the workflow process',
                    required: false
                }
            ]
        },
        {
            name: 'workflow-status',
            description: 'Check workflow system status'
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
    
    if (commandName === 'workflow') {
        const channel = options.getChannel('channel') || interaction.channel;
        const title = options.getString('title') || 'Workflow Process';
        const description = options.getString('description') || 'Click the button below to start the workflow process.';
        
        // Check permissions
        if (!canStartWorkflow(interaction.member)) {
            return await interaction.reply({
                content: '❌ You don\'t have permission to start workflow processes.',
                ephemeral: true
            });
        }
        
        // Create embed and button
        const embed = createWorkflowEmbed(title, description, interaction.member);
        const button = new ButtonBuilder()
            .setCustomId('start_workflow')
            .setLabel('Start Process')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🚀');
        
        const statusButton = new ButtonBuilder()
            .setCustomId('check_status')
            .setLabel('Check Status')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊');
        
        const row = new ActionRowBuilder().addComponents(button, statusButton);
        
        try {
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({
                content: `✅ Workflow embed sent to ${channel}`,
                ephemeral: true
            });
            console.log(`Workflow started by ${interaction.user.tag} in ${channel.name}`);
        } catch (error) {
            await interaction.reply({
                content: '❌ I don\'t have permission to send messages to that channel.',
                ephemeral: true
            });
        }
    }
    
    else if (commandName === 'workflow-status') {
        const embed = new EmbedBuilder()
            .setTitle('📊 Workflow System Status')
            .setColor(0x0099FF)
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
        permStatus.push(permissions.has(PermissionFlagsBits.ManageRoles) ? '✅ Manage Roles' : '❌ Manage Roles');
        
        embed.addFields({ name: 'Bot Permissions', value: permStatus.join('\n'), inline: false });
        
        await interaction.reply({ embeds: [embed] });
    }
}

// Handle button interactions
async function handleButtonInteraction(interaction) {
    const { customId } = interaction;
    
    if (customId === 'start_workflow') {
        // Check permissions
        if (!canParticipate(interaction.member)) {
            return await interaction.reply({
                content: '❌ You don\'t have permission to participate in workflows.',
                ephemeral: true
            });
        }
        
        // Create thread
        const threadName = `workflow-${interaction.member.displayName}-${Date.now()}`;
        
        try {
            const thread = await interaction.channel.threads.create({
                name: threadName,
                autoArchiveDuration: 60,
                reason: `Workflow process started by ${interaction.user.tag}`
            });
            
            // Create welcome embed
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎯 Workflow Process Started')
                .setDescription(`Welcome ${interaction.member}! Your workflow process has begun.`)
                .setColor(0x0099FF)
                .addFields({
                    name: 'Next Steps',
                    value: 'Please complete the verification process below.',
                    inline: false
                })
                .setTimestamp();
            
            // Create verification button
            const verifyButton = new ButtonBuilder()
                .setCustomId(`verify_role_${interaction.user.id}`)
                .setLabel('Verify Role')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');
            
            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_workflow_${interaction.user.id}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');
            
            const verifyRow = new ActionRowBuilder().addComponents(verifyButton, cancelButton);
            
            await thread.send({ embeds: [welcomeEmbed], components: [verifyRow] });
            
            await interaction.reply({
                content: `✅ Workflow thread created: ${thread}`,
                ephemeral: true
            });
            
            console.log(`Workflow thread created by ${interaction.user.tag} in ${interaction.guild.name}`);
            
        } catch (error) {
            console.error('Error creating thread:', error);
            await interaction.reply({
                content: '❌ I don\'t have permission to create threads in this channel.',
                ephemeral: true
            });
        }
    }
    
    else if (customId === 'check_status') {
        const userLevel = isAdmin(interaction.member) ? 'Admin' : 
                         isManager(interaction.member) ? 'Manager' : 
                         isUser(interaction.member) ? 'User' : 'No Permissions';
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Your Workflow Status')
            .setColor(0x0099FF)
            .addFields(
                { name: 'User', value: interaction.member.toString(), inline: true },
                { name: 'Permission Level', value: userLevel, inline: true },
                { name: 'Server', value: interaction.guild.name, inline: true }
            )
            .setTimestamp();
        
        // Add role information
        const roles = interaction.member.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => role.name)
            .join(', ');
        
        embed.addFields({
            name: 'Your Roles',
            value: roles || 'No special roles',
            inline: false
        });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (customId.startsWith('verify_role_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the workflow initiator can verify their role.',
                ephemeral: true
            });
        }
        
        // Check if user has manager or admin role
        if (!isManager(interaction.member) && !isAdmin(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need Manager or Admin role to complete this workflow.',
                ephemeral: true
            });
        }
        
        // Role verified, proceed to final step
        const roleType = isAdmin(interaction.member) ? 'Admin' : 'Manager';
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Role Verified')
            .setDescription(`Your ${roleType} role has been verified!`)
            .setColor(0x00FF00)
            .addFields({
                name: 'Next Step',
                value: 'Click \'Create Channel\' to complete the workflow.',
                inline: false
            })
            .setTimestamp();
        
        // Create final step button
        const createChannelButton = new ButtonBuilder()
            .setCustomId(`create_channel_${interaction.user.id}`)
            .setLabel('Create Channel')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🆕');
        
        const finalRow = new ActionRowBuilder().addComponents(createChannelButton);
        
        await interaction.update({ embeds: [embed], components: [finalRow] });
        
        console.log(`${roleType} role verified for ${interaction.user.tag}`);
    }
    
    else if (customId.startsWith('cancel_workflow_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the workflow initiator can cancel this workflow.',
                ephemeral: true
            });
        }
        
        const embed = createErrorEmbed(
            'Workflow Cancelled',
            'The workflow has been cancelled by the user.'
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
        
        console.log(`Workflow cancelled by ${interaction.user.tag}`);
    }
    
    else if (customId.startsWith('create_channel_')) {
        const userId = customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the workflow initiator can create the channel.',
                ephemeral: true
            });
        }
        
        // Create a new text channel
        const channelName = `workflow-result-${interaction.member.displayName}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        
        try {
            // Set up channel permissions
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
                        PermissionFlagsBits.ManageMessages
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
            
            // Add workflow roles to permissions
            const workflowRoles = interaction.member.roles.cache.filter(role => 
                config.adminRoles.includes(role.name) || 
                config.managerRoles.includes(role.name)
            );
            
            workflowRoles.forEach(role => {
                overwrites.push({
                    id: role.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                });
            });
            
            const newChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: overwrites,
                reason: `Workflow completion channel for ${interaction.user.tag}`
            });
            
            // Send success message
            const successEmbed = createSuccessEmbed(
                'Workflow Complete!',
                `Congratulations! Your workflow has been completed successfully.\n\n` +
                `**New Channel Created:** ${newChannel}\n` +
                `**Completed by:** ${interaction.member}\n` +
                `**Completion Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
            );
            
            await interaction.update({ embeds: [successEmbed], components: [] });
            
            // Send welcome message to new channel
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎉 Welcome to Your New Channel!')
                .setDescription('This channel was created through the workflow system.')
                .setColor(0xFFD700)
                .addFields(
                    { name: 'Channel Owner', value: interaction.member.toString(), inline: true },
                    { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setTimestamp();
            
            await newChannel.send({ embeds: [welcomeEmbed] });
            
            // Archive the workflow thread
            if (interaction.channel.isThread()) {
                setTimeout(async () => {
                    try {
                        await interaction.channel.setArchived(true);
                    } catch (error) {
                        console.error('Error archiving thread:', error);
                    }
                }, 10000);
            }
            
            console.log(`Workflow completed by ${interaction.user.tag}, channel ${newChannel.name} created`);
            
        } catch (error) {
            console.error('Error creating channel:', error);
            await interaction.reply({
                content: '❌ I don\'t have permission to create channels in this server.',
                ephemeral: true
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