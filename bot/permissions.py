import discord
from typing import List, Optional
import logging
from config import Config

logger = logging.getLogger(__name__)

class PermissionChecker:
    """Handle role-based permission checking for the workflow system"""
    
    def __init__(self, guild: discord.Guild):
        self.guild = guild
        self.config = Config()
    
    async def is_admin(self, user: discord.Member) -> bool:
        """Check if user has admin workflow permissions"""
        try:
            # Check if user is server administrator
            if user.guild_permissions.administrator:
                return True
            
            # Check for specific admin roles
            admin_role_names = ['Workflow Admin', 'Admin', 'Administrator']
            for role in user.roles:
                if role.name in admin_role_names:
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking admin permissions for {user}: {e}")
            return False
    
    async def is_manager(self, user: discord.Member) -> bool:
        """Check if user has manager workflow permissions"""
        try:
            # Admins are also managers
            if await self.is_admin(user):
                return True
            
            # Check for specific manager roles
            manager_role_names = ['Workflow Manager', 'Manager', 'Moderator', 'Staff']
            for role in user.roles:
                if role.name in manager_role_names:
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking manager permissions for {user}: {e}")
            return False
    
    async def is_user(self, user: discord.Member) -> bool:
        """Check if user has basic workflow permissions"""
        try:
            # Check for specific user roles
            user_role_names = ['Workflow User', 'Member', 'Verified']
            for role in user.roles:
                if role.name in user_role_names:
                    return True
            
            # If no specific roles, check if they have at least one role beyond @everyone
            non_everyone_roles = [role for role in user.roles if role.name != "@everyone"]
            return len(non_everyone_roles) > 0
            
        except Exception as e:
            logger.error(f"Error checking user permissions for {user}: {e}")
            return False
    
    async def can_start_workflow(self, user: discord.Member) -> bool:
        """Check if user can start workflow processes"""
        try:
            # Managers and admins can start workflows
            return await self.is_manager(user) or await self.is_admin(user)
            
        except Exception as e:
            logger.error(f"Error checking workflow start permissions for {user}: {e}")
            return False
    
    async def can_participate(self, user: discord.Member) -> bool:
        """Check if user can participate in workflows"""
        try:
            # Any user with workflow permissions can participate
            return (await self.is_user(user) or 
                   await self.is_manager(user) or 
                   await self.is_admin(user))
            
        except Exception as e:
            logger.error(f"Error checking participation permissions for {user}: {e}")
            return False
    
    async def can_manage_channels(self, user: discord.Member) -> bool:
        """Check if user can manage channels"""
        try:
            # Check Discord permissions
            if user.guild_permissions.manage_channels:
                return True
            
            # Check workflow admin status
            return await self.is_admin(user)
            
        except Exception as e:
            logger.error(f"Error checking channel management permissions for {user}: {e}")
            return False
    
    async def can_manage_threads(self, user: discord.Member) -> bool:
        """Check if user can manage threads"""
        try:
            # Check Discord permissions
            if user.guild_permissions.manage_threads:
                return True
            
            # Check workflow manager/admin status
            return await self.is_manager(user) or await self.is_admin(user)
            
        except Exception as e:
            logger.error(f"Error checking thread management permissions for {user}: {e}")
            return False
    
    async def get_user_level(self, user: discord.Member) -> str:
        """Get the highest permission level for a user"""
        try:
            if await self.is_admin(user):
                return "Admin"
            elif await self.is_manager(user):
                return "Manager"
            elif await self.is_user(user):
                return "User"
            else:
                return "No Permissions"
                
        except Exception as e:
            logger.error(f"Error getting user level for {user}: {e}")
            return "Error"
    
    async def is_workflow_role(self, role: discord.Role) -> bool:
        """Check if a role is a workflow-related role"""
        workflow_role_names = [
            'Workflow Admin', 'Admin', 'Administrator',
            'Workflow Manager', 'Manager', 'Moderator', 'Staff',
            'Workflow User', 'Member', 'Verified'
        ]
        return role.name in workflow_role_names
    
    async def get_required_roles_for_action(self, action: str) -> List[str]:
        """Get list of roles required for specific actions"""
        role_requirements = {
            'start_workflow': ['Workflow Admin', 'Admin', 'Workflow Manager', 'Manager'],
            'participate': ['Workflow User', 'Member', 'Verified', 'Workflow Manager', 'Manager', 'Workflow Admin', 'Admin'],
            'manage_channels': ['Workflow Admin', 'Admin'],
            'manage_threads': ['Workflow Manager', 'Manager', 'Workflow Admin', 'Admin'],
            'verify_role': ['Workflow Manager', 'Manager', 'Workflow Admin', 'Admin']
        }
        
        return role_requirements.get(action, [])
    
    async def check_role_hierarchy(self, user: discord.Member, target_role: discord.Role) -> bool:
        """Check if user can assign/manage a specific role based on hierarchy"""
        try:
            # Server administrators can manage all roles
            if user.guild_permissions.administrator:
                return True
            
            # Check if user's highest role is higher than target role
            user_top_role = user.top_role
            return user_top_role > target_role
            
        except Exception as e:
            logger.error(f"Error checking role hierarchy for {user}: {e}")
            return False
