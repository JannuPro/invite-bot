import os
from dotenv import load_dotenv
from typing import List, Optional

# Load environment variables
load_dotenv()

class Config:
    """Configuration class for the Discord bot"""
    
    # Bot Configuration
    BOT_TOKEN: str = os.getenv('DISCORD_BOT_TOKEN', '')
    COMMAND_PREFIX: str = os.getenv('COMMAND_PREFIX', '!')
    
    # Role Configuration (fallback role names if not configured via commands)
    DEFAULT_ADMIN_ROLES: List[str] = [
        'Workflow Admin',
        'Admin', 
        'Administrator',
        'Owner'
    ]
    
    DEFAULT_MANAGER_ROLES: List[str] = [
        'Workflow Manager',
        'Manager',
        'Moderator',
        'Staff',
        'Mod'
    ]
    
    DEFAULT_USER_ROLES: List[str] = [
        'Workflow User',
        'Member',
        'Verified',
        'User'
    ]
    
    # Workflow Configuration
    WORKFLOW_TIMEOUT: int = int(os.getenv('WORKFLOW_TIMEOUT', '600'))  # 10 minutes
    THREAD_AUTO_ARCHIVE: int = int(os.getenv('THREAD_AUTO_ARCHIVE', '60'))  # 1 hour
    MAX_CONCURRENT_WORKFLOWS: int = int(os.getenv('MAX_CONCURRENT_WORKFLOWS', '10'))
    
    # Channel Configuration
    WORKFLOW_CATEGORY: Optional[str] = os.getenv('WORKFLOW_CATEGORY')
    DEFAULT_CHANNEL_PREFIX: str = os.getenv('DEFAULT_CHANNEL_PREFIX', 'workflow-')
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE: str = os.getenv('LOG_FILE', 'bot.log')
    
    # Feature Flags
    ENABLE_THREAD_CREATION: bool = os.getenv('ENABLE_THREAD_CREATION', 'true').lower() == 'true'
    ENABLE_CHANNEL_CREATION: bool = os.getenv('ENABLE_CHANNEL_CREATION', 'true').lower() == 'true'
    ENABLE_ROLE_VERIFICATION: bool = os.getenv('ENABLE_ROLE_VERIFICATION', 'true').lower() == 'true'
    
    # Security Configuration
    REQUIRE_ROLE_FOR_WORKFLOW: bool = os.getenv('REQUIRE_ROLE_FOR_WORKFLOW', 'true').lower() == 'true'
    ALLOW_DM_COMMANDS: bool = os.getenv('ALLOW_DM_COMMANDS', 'false').lower() == 'true'
    
    # Rate Limiting
    WORKFLOW_COOLDOWN: int = int(os.getenv('WORKFLOW_COOLDOWN', '30'))  # seconds
    COMMAND_RATE_LIMIT: int = int(os.getenv('COMMAND_RATE_LIMIT', '5'))  # commands per minute
    
    @classmethod
    def validate_config(cls) -> bool:
        """Validate the configuration"""
        if not cls.BOT_TOKEN:
            print("ERROR: DISCORD_BOT_TOKEN is required!")
            return False
        
        if cls.WORKFLOW_TIMEOUT < 60:
            print("WARNING: WORKFLOW_TIMEOUT is less than 60 seconds, setting to 60")
            cls.WORKFLOW_TIMEOUT = 60
        
        if cls.MAX_CONCURRENT_WORKFLOWS < 1:
            print("WARNING: MAX_CONCURRENT_WORKFLOWS is less than 1, setting to 1")
            cls.MAX_CONCURRENT_WORKFLOWS = 1
        
        return True
    
    @classmethod
    def get_role_names(cls, role_type: str) -> List[str]:
        """Get role names for a specific type"""
        role_map = {
            'admin': cls.DEFAULT_ADMIN_ROLES,
            'manager': cls.DEFAULT_MANAGER_ROLES,
            'user': cls.DEFAULT_USER_ROLES
        }
        return role_map.get(role_type.lower(), [])
    
    @classmethod
    def is_feature_enabled(cls, feature: str) -> bool:
        """Check if a feature is enabled"""
        feature_map = {
            'thread_creation': cls.ENABLE_THREAD_CREATION,
            'channel_creation': cls.ENABLE_CHANNEL_CREATION,
            'role_verification': cls.ENABLE_ROLE_VERIFICATION
        }
        return feature_map.get(feature.lower(), True)
