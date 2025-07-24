import discord
from discord.ext import commands
from discord import app_commands
import logging
from typing import Optional
from .views import WorkflowView
from .permissions import PermissionChecker
from .utils import create_workflow_embed

logger = logging.getLogger(__name__)

async def setup_commands(bot: commands.Bot):
    """Setup all slash commands for the bot"""
    
    @bot.tree.command(name="workflow", description="Start a role-based workflow process")
    @app_commands.describe(
        channel="The channel to send the workflow embed to",
        title="Title for the workflow embed",
        description="Description for the workflow process"
    )
    async def workflow_command(
        interaction: discord.Interaction,
        channel: Optional[discord.TextChannel] = None,
        title: str = "Workflow Process",
        description: str = "Click the button below to start the workflow process."
    ):
        """Start a workflow process with interactive embed"""
        try:
            # Use current channel if none specified
            target_channel = channel or interaction.channel
            
            # Check if user has permission to use workflow commands
            permission_checker = PermissionChecker(interaction.guild)
            if not await permission_checker.can_start_workflow(interaction.user):
                await interaction.response.send_message(
                    "❌ You don't have permission to start workflow processes.", 
                    ephemeral=True
                )
                return
            
            # Create workflow embed
            embed = create_workflow_embed(title, description, interaction.user)
            
            # Create view with buttons
            view = WorkflowView(bot, interaction.user)
            
            # Send embed to target channel
            message = await target_channel.send(embed=embed, view=view)
            
            # Log the workflow initiation
            logger.info(f"Workflow started by {interaction.user} in {target_channel}")
            
            await interaction.response.send_message(
                f"✅ Workflow embed sent to {target_channel.mention}",
                ephemeral=True
            )
            
        except discord.Forbidden:
            await interaction.response.send_message(
                "❌ I don't have permission to send messages to that channel.",
                ephemeral=True
            )
        except Exception as e:
            logger.error(f"Error in workflow command: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while starting the workflow.",
                ephemeral=True
            )
    
    @bot.tree.command(name="setup-roles", description="Setup workflow roles for the server")
    @app_commands.describe(
        admin_role="Role for workflow administrators",
        manager_role="Role for workflow managers",
        user_role="Role for basic workflow users"
    )
    async def setup_roles_command(
        interaction: discord.Interaction,
        admin_role: discord.Role,
        manager_role: discord.Role,
        user_role: discord.Role
    ):
        """Setup roles for the workflow system"""
        try:
            # Check if user is server administrator
            if not interaction.user.guild_permissions.administrator:
                await interaction.response.send_message(
                    "❌ Only server administrators can setup workflow roles.",
                    ephemeral=True
                )
                return
            
            # Store role IDs (in a real application, you'd save these to a database)
            embed = discord.Embed(
                title="🔧 Workflow Roles Setup",
                description="Workflow roles have been configured:",
                color=discord.Color.green()
            )
            embed.add_field(name="Admin Role", value=admin_role.mention, inline=True)
            embed.add_field(name="Manager Role", value=manager_role.mention, inline=True)
            embed.add_field(name="User Role", value=user_role.mention, inline=True)
            embed.set_footer(text=f"Setup by {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed)
            
            logger.info(f"Roles setup by {interaction.user}: Admin={admin_role.id}, Manager={manager_role.id}, User={user_role.id}")
            
        except Exception as e:
            logger.error(f"Error in setup-roles command: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while setting up roles.",
                ephemeral=True
            )
    
    @bot.tree.command(name="workflow-status", description="Check workflow system status")
    async def workflow_status_command(interaction: discord.Interaction):
        """Display workflow system status"""
        try:
            embed = discord.Embed(
                title="📊 Workflow System Status",
                color=discord.Color.blue()
            )
            
            # Bot information
            embed.add_field(
                name="Bot Status",
                value="🟢 Online and Ready",
                inline=True
            )
            
            # Server information
            embed.add_field(
                name="Server",
                value=f"{interaction.guild.name}",
                inline=True
            )
            
            # Permissions check
            bot_member = interaction.guild.get_member(interaction.client.user.id)
            permissions = bot_member.guild_permissions
            
            perm_status = []
            if permissions.manage_channels:
                perm_status.append("✅ Manage Channels")
            else:
                perm_status.append("❌ Manage Channels")
                
            if permissions.manage_threads:
                perm_status.append("✅ Manage Threads")
            else:
                perm_status.append("❌ Manage Threads")
                
            if permissions.manage_roles:
                perm_status.append("✅ Manage Roles")
            else:
                perm_status.append("❌ Manage Roles")
            
            embed.add_field(
                name="Bot Permissions",
                value="\n".join(perm_status),
                inline=False
            )
            
            embed.set_footer(text=f"Requested by {interaction.user.display_name}")
            
            await interaction.response.send_message(embed=embed)
            
        except Exception as e:
            logger.error(f"Error in workflow-status command: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while checking status.",
                ephemeral=True
            )
