import discord
from discord.ext import commands
import logging
from typing import Optional
from .permissions import PermissionChecker
from .utils import create_success_embed, create_error_embed

logger = logging.getLogger(__name__)

class WorkflowView(discord.ui.View):
    def __init__(self, bot: commands.Bot, initiator: discord.Member):
        super().__init__(timeout=300.0)  # 5 minute timeout
        self.bot = bot
        self.initiator = initiator
        self.permission_checker = PermissionChecker(initiator.guild)
    
    async def on_timeout(self):
        """Called when the view times out"""
        # Disable all buttons
        for item in self.children:
            item.disabled = True
        
        # Try to edit the message to show it's expired
        try:
            embed = discord.Embed(
                title="⏰ Workflow Expired",
                description="This workflow has expired. Please start a new one.",
                color=discord.Color.red()
            )
            await self.message.edit(embed=embed, view=self)
        except:
            pass
    
    @discord.ui.button(label='Start Process', style=discord.ButtonStyle.primary, emoji='🚀')
    async def start_process(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Start the workflow process"""
        try:
            # Check user permissions
            if not await self.permission_checker.can_participate(interaction.user):
                await interaction.response.send_message(
                    "❌ You don't have permission to participate in workflows.",
                    ephemeral=True
                )
                return
            
            # Create a thread for this workflow
            thread_name = f"workflow-{interaction.user.display_name}-{interaction.id}"
            thread = await interaction.channel.create_thread(
                name=thread_name,
                type=discord.ChannelType.public_thread,
                reason=f"Workflow process started by {interaction.user}"
            )
            
            # Send welcome message to thread
            welcome_embed = discord.Embed(
                title="🎯 Workflow Process Started",
                description=f"Welcome {interaction.user.mention}! Your workflow process has begun.",
                color=discord.Color.blue()
            )
            welcome_embed.add_field(
                name="Next Steps",
                value="Please complete the verification process below.",
                inline=False
            )
            
            # Create verification view
            verification_view = VerificationView(self.bot, interaction.user, thread)
            
            await thread.send(embed=welcome_embed, view=verification_view)
            
            await interaction.response.send_message(
                f"✅ Workflow thread created: {thread.mention}",
                ephemeral=True
            )
            
            logger.info(f"Workflow thread created by {interaction.user} in {interaction.guild}")
            
        except discord.Forbidden:
            await interaction.response.send_message(
                "❌ I don't have permission to create threads in this channel.",
                ephemeral=True
            )
        except Exception as e:
            logger.error(f"Error starting process: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while starting the process.",
                ephemeral=True
            )
    
    @discord.ui.button(label='Check Status', style=discord.ButtonStyle.secondary, emoji='📊')
    async def check_status(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Check workflow status"""
        try:
            user_level = await self.permission_checker.get_user_level(interaction.user)
            
            embed = discord.Embed(
                title="📊 Your Workflow Status",
                color=discord.Color.blue()
            )
            embed.add_field(name="User", value=interaction.user.mention, inline=True)
            embed.add_field(name="Permission Level", value=user_level, inline=True)
            embed.add_field(name="Server", value=interaction.guild.name, inline=True)
            
            # Add role information
            roles = [role.name for role in interaction.user.roles if role.name != "@everyone"]
            embed.add_field(
                name="Your Roles",
                value=", ".join(roles) if roles else "No special roles",
                inline=False
            )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except Exception as e:
            logger.error(f"Error checking status: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while checking status.",
                ephemeral=True
            )

class VerificationView(discord.ui.View):
    def __init__(self, bot: commands.Bot, user: discord.Member, thread: discord.Thread):
        super().__init__(timeout=600.0)  # 10 minute timeout
        self.bot = bot
        self.user = user
        self.thread = thread
        self.permission_checker = PermissionChecker(user.guild)
    
    @discord.ui.button(label='Verify Role', style=discord.ButtonStyle.success, emoji='✅')
    async def verify_role(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Verify user role and proceed with workflow"""
        try:
            if interaction.user != self.user:
                await interaction.response.send_message(
                    "❌ Only the workflow initiator can verify their role.",
                    ephemeral=True
                )
                return
            
            # Check if user has manager or admin role
            is_manager = await self.permission_checker.is_manager(interaction.user)
            is_admin = await self.permission_checker.is_admin(interaction.user)
            
            if not (is_manager or is_admin):
                await interaction.response.send_message(
                    "❌ You need Manager or Admin role to complete this workflow.",
                    ephemeral=True
                )
                return
            
            # Role verified, proceed to final step
            role_type = "Admin" if is_admin else "Manager"
            
            embed = discord.Embed(
                title="✅ Role Verified",
                description=f"Your {role_type} role has been verified!",
                color=discord.Color.green()
            )
            embed.add_field(
                name="Next Step",
                value="Click 'Create Channel' to complete the workflow.",
                inline=False
            )
            
            # Create final step view
            final_view = FinalStepView(self.bot, interaction.user, self.thread)
            
            await interaction.response.edit_message(embed=embed, view=final_view)
            
            logger.info(f"{role_type} role verified for {interaction.user}")
            
        except Exception as e:
            logger.error(f"Error verifying role: {e}")
            await interaction.response.send_message(
                "❌ An error occurred during role verification.",
                ephemeral=True
            )
    
    @discord.ui.button(label='Cancel', style=discord.ButtonStyle.danger, emoji='❌')
    async def cancel_workflow(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Cancel the workflow"""
        try:
            if interaction.user != self.user:
                await interaction.response.send_message(
                    "❌ Only the workflow initiator can cancel this workflow.",
                    ephemeral=True
                )
                return
            
            embed = create_error_embed(
                "Workflow Cancelled",
                "The workflow has been cancelled by the user."
            )
            
            # Disable all buttons
            for item in self.children:
                item.disabled = True
            
            await interaction.response.edit_message(embed=embed, view=self)
            
            # Archive the thread after a delay
            await self.thread.edit(archived=True, reason="Workflow cancelled")
            
            logger.info(f"Workflow cancelled by {interaction.user}")
            
        except Exception as e:
            logger.error(f"Error cancelling workflow: {e}")

class FinalStepView(discord.ui.View):
    def __init__(self, bot: commands.Bot, user: discord.Member, thread: discord.Thread):
        super().__init__(timeout=300.0)  # 5 minute timeout
        self.bot = bot
        self.user = user
        self.thread = thread
        self.permission_checker = PermissionChecker(user.guild)
    
    @discord.ui.button(label='Create Channel', style=discord.ButtonStyle.success, emoji='🆕')
    async def create_channel(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Create a new channel as the final step"""
        try:
            if interaction.user != self.user:
                await interaction.response.send_message(
                    "❌ Only the workflow initiator can create the channel.",
                    ephemeral=True
                )
                return
            
            # Create a new text channel
            channel_name = f"workflow-result-{interaction.user.name}".lower().replace(" ", "-")
            
            # Set up channel permissions
            overwrites = {
                interaction.guild.default_role: discord.PermissionOverwrite(read_messages=False),
                interaction.user: discord.PermissionOverwrite(
                    read_messages=True,
                    send_messages=True,
                    manage_messages=True
                ),
                interaction.guild.me: discord.PermissionOverwrite(
                    read_messages=True,
                    send_messages=True,
                    manage_messages=True
                )
            }
            
            # Add manager/admin roles to channel permissions
            for role in interaction.user.roles:
                if await self.permission_checker.is_workflow_role(role):
                    overwrites[role] = discord.PermissionOverwrite(
                        read_messages=True,
                        send_messages=True
                    )
            
            new_channel = await interaction.guild.create_text_channel(
                name=channel_name,
                overwrites=overwrites,
                reason=f"Workflow completion channel for {interaction.user}"
            )
            
            # Send success message
            success_embed = create_success_embed(
                "Workflow Complete!",
                f"Congratulations! Your workflow has been completed successfully.\n\n"
                f"**New Channel Created:** {new_channel.mention}\n"
                f"**Completed by:** {interaction.user.mention}\n"
                f"**Completion Time:** <t:{int(interaction.created_at.timestamp())}:F>"
            )
            
            # Disable all buttons
            for item in self.children:
                item.disabled = True
            
            await interaction.response.edit_message(embed=success_embed, view=self)
            
            # Send welcome message to new channel
            welcome_embed = discord.Embed(
                title="🎉 Welcome to Your New Channel!",
                description=f"This channel was created through the workflow system.",
                color=discord.Color.gold()
            )
            welcome_embed.add_field(
                name="Channel Owner",
                value=interaction.user.mention,
                inline=True
            )
            welcome_embed.add_field(
                name="Created",
                value=f"<t:{int(interaction.created_at.timestamp())}:R>",
                inline=True
            )
            
            await new_channel.send(embed=welcome_embed)
            
            # Archive the workflow thread
            await self.thread.edit(archived=True, reason="Workflow completed successfully")
            
            logger.info(f"Workflow completed by {interaction.user}, channel {new_channel.name} created")
            
        except discord.Forbidden:
            await interaction.response.send_message(
                "❌ I don't have permission to create channels in this server.",
                ephemeral=True
            )
        except Exception as e:
            logger.error(f"Error creating channel: {e}")
            await interaction.response.send_message(
                "❌ An error occurred while creating the channel.",
                ephemeral=True
            )
