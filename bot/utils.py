import discord
from datetime import datetime
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def create_workflow_embed(title: str, description: str, initiator: discord.Member) -> discord.Embed:
    """Create a workflow embed with consistent styling"""
    embed = discord.Embed(
        title=f"🔄 {title}",
        description=description,
        color=discord.Color.blue(),
        timestamp=datetime.utcnow()
    )
    
    embed.add_field(
        name="Initiated by",
        value=initiator.mention,
        inline=True
    )
    
    embed.add_field(
        name="Server",
        value=initiator.guild.name,
        inline=True
    )
    
    embed.add_field(
        name="Status",
        value="🟡 Waiting for interaction",
        inline=True
    )
    
    embed.set_footer(
        text="Click the buttons below to interact with this workflow",
        icon_url=initiator.display_avatar.url
    )
    
    # Add workflow instructions
    embed.add_field(
        name="📋 Instructions",
        value=(
            "1. Click **Start Process** to begin\n"
            "2. Complete verification in the created thread\n"
            "3. Channel will be created upon successful completion"
        ),
        inline=False
    )
    
    return embed

def create_success_embed(title: str, description: str) -> discord.Embed:
    """Create a success embed with consistent styling"""
    embed = discord.Embed(
        title=f"✅ {title}",
        description=description,
        color=discord.Color.green(),
        timestamp=datetime.utcnow()
    )
    
    embed.set_footer(text="Workflow completed successfully")
    
    return embed

def create_error_embed(title: str, description: str) -> discord.Embed:
    """Create an error embed with consistent styling"""
    embed = discord.Embed(
        title=f"❌ {title}",
        description=description,
        color=discord.Color.red(),
        timestamp=datetime.utcnow()
    )
    
    embed.set_footer(text="If this error persists, contact an administrator")
    
    return embed

def create_info_embed(title: str, description: str) -> discord.Embed:
    """Create an info embed with consistent styling"""
    embed = discord.Embed(
        title=f"ℹ️ {title}",
        description=description,
        color=discord.Color.blue(),
        timestamp=datetime.utcnow()
    )
    
    return embed

def create_warning_embed(title: str, description: str) -> discord.Embed:
    """Create a warning embed with consistent styling"""
    embed = discord.Embed(
        title=f"⚠️ {title}",
        description=description,
        color=discord.Color.orange(),
        timestamp=datetime.utcnow()
    )
    
    return embed

def format_user_info(user: discord.Member) -> str:
    """Format user information for display"""
    info_parts = [
        f"**User:** {user.mention}",
        f"**Display Name:** {user.display_name}",
        f"**ID:** {user.id}",
        f"**Joined Server:** <t:{int(user.joined_at.timestamp())}:R>" if user.joined_at else "**Joined Server:** Unknown",
        f"**Account Created:** <t:{int(user.created_at.timestamp())}:R>"
    ]
    
    return "\n".join(info_parts)

def format_channel_info(channel: discord.TextChannel) -> str:
    """Format channel information for display"""
    info_parts = [
        f"**Channel:** {channel.mention}",
        f"**Name:** {channel.name}",
        f"**ID:** {channel.id}",
        f"**Category:** {channel.category.name if channel.category else 'None'}",
        f"**Created:** <t:{int(channel.created_at.timestamp())}:R>"
    ]
    
    return "\n".join(info_parts)

def format_role_list(roles: list) -> str:
    """Format a list of roles for display"""
    if not roles:
        return "No roles"
    
    # Filter out @everyone role and sort by position
    filtered_roles = [role for role in roles if role.name != "@everyone"]
    sorted_roles = sorted(filtered_roles, key=lambda r: r.position, reverse=True)
    
    if not sorted_roles:
        return "No special roles"
    
    return ", ".join([role.mention for role in sorted_roles[:10]])  # Limit to 10 roles

def sanitize_channel_name(name: str) -> str:
    """Sanitize a string to be used as a Discord channel name"""
    # Convert to lowercase and replace spaces with hyphens
    sanitized = name.lower().replace(" ", "-")
    
    # Remove invalid characters
    valid_chars = "abcdefghijklmnopqrstuvwxyz0123456789-_"
    sanitized = "".join(char for char in sanitized if char in valid_chars)
    
    # Ensure it doesn't start or end with hyphens
    sanitized = sanitized.strip("-")
    
    # Ensure minimum length and maximum length
    if len(sanitized) < 2:
        sanitized = "workflow-channel"
    elif len(sanitized) > 100:
        sanitized = sanitized[:100]
    
    return sanitized

def create_permission_error_embed(required_permission: str, user: discord.Member) -> discord.Embed:
    """Create an embed for permission errors"""
    embed = create_error_embed(
        "Permission Denied",
        f"You need the **{required_permission}** permission to perform this action."
    )
    
    embed.add_field(
        name="Your Current Roles",
        value=format_role_list(user.roles),
        inline=False
    )
    
    embed.add_field(
        name="Need Help?",
        value="Contact a server administrator to get the required permissions.",
        inline=False
    )
    
    return embed

def create_bot_permission_error_embed(required_permission: str) -> discord.Embed:
    """Create an embed for bot permission errors"""
    embed = create_error_embed(
        "Bot Permission Error",
        f"I don't have the **{required_permission}** permission to perform this action."
    )
    
    embed.add_field(
        name="Solution",
        value="Please ask a server administrator to grant me the required permissions.",
        inline=False
    )
    
    return embed

def log_workflow_action(action: str, user: discord.Member, details: str = ""):
    """Log workflow actions with consistent formatting"""
    logger.info(
        f"WORKFLOW ACTION: {action} | "
        f"User: {user} ({user.id}) | "
        f"Guild: {user.guild.name} ({user.guild.id}) | "
        f"Details: {details}"
    )

def create_thread_name(user: discord.Member, workflow_type: str = "general") -> str:
    """Create a consistent thread name format"""
    timestamp = datetime.utcnow().strftime("%m%d-%H%M")
    sanitized_username = sanitize_channel_name(user.display_name)
    return f"workflow-{workflow_type}-{sanitized_username}-{timestamp}"

def get_embed_color_for_status(status: str) -> discord.Color:
    """Get appropriate color for different workflow statuses"""
    color_map = {
        'pending': discord.Color.yellow(),
        'in_progress': discord.Color.blue(),
        'completed': discord.Color.green(),
        'failed': discord.Color.red(),
        'cancelled': discord.Color.orange(),
        'expired': discord.Color.dark_grey()
    }
    
    return color_map.get(status.lower(), discord.Color.blue())
