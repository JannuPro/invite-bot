# Discord Workflow Bot

## Overview

This is a Discord bot that implements a role-based workflow system with interactive embeds, button interactions, thread management, and dynamic channel creation. The bot uses Discord.js v14 with slash commands and provides a structured workflow process for Discord servers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modular architecture with clear separation of concerns:

- **Main Entry Point**: `main.py` handles bot initialization and startup
- **Configuration**: `config.py` provides centralized configuration management
- **Command System**: `bot/commands.py` manages slash command registration and handling
- **Permission System**: `bot/permissions.py` implements role-based access control
- **UI Components**: `bot/views.py` handles Discord UI interactions (buttons, modals)
- **Utilities**: `bot/utils.py` provides helper functions for embed creation and formatting

## Key Components

### Bot Framework
- **Discord.js**: Modern Discord API wrapper with slash command support
- **Intents**: Configured for guilds and guild messages access
- **Command Registration**: Uses Discord's application command system for slash commands

### Permission System
- **Role-Based Access Control**: Three-tier system (Admin, Manager, User)
- **Fallback Roles**: Default role names with customization support
- **Permission Inheritance**: Admins inherit manager permissions, managers inherit user permissions

### Workflow Engine
- **Interactive Embeds**: Rich embed messages with status tracking
- **Button Interactions**: Discord UI components for user interaction
- **Thread Creation**: Automatic thread generation for workflow processes
- **Channel Management**: Dynamic channel creation upon workflow completion

### Configuration Management
- **Environment Variables**: Secure configuration via .env files
- **Fallback Values**: Default configurations for all settings
- **Timeout Settings**: Configurable timeouts for workflows and threads

## Data Flow

1. **Workflow Initiation**: User executes `/workflow` slash command
2. **Permission Check**: System verifies user has required permissions
3. **Embed Creation**: Bot creates interactive embed with workflow information
4. **User Interaction**: User clicks "Start Process" button
5. **Thread Creation**: Bot creates dedicated thread for workflow process
6. **Verification Process**: User completes verification within thread
7. **Channel Creation**: Upon successful completion, new channel is created
8. **Cleanup**: Thread is archived and workflow is marked complete

## External Dependencies

### Required Packages
- **discord.py**: Discord API wrapper and bot framework
- **python-dotenv**: Environment variable management

### Discord API Requirements
- **Bot Token**: Required for Discord authentication
- **Guild Permissions**: Manage channels, threads, messages, and slash commands
- **Member Intent**: Required for role-based permission checking

### Environment Configuration
- **DISCORD_BOT_TOKEN**: Bot authentication token
- **WORKFLOW_TIMEOUT**: Configurable workflow timeout duration
- **THREAD_AUTO_ARCHIVE**: Thread auto-archive duration
- **MAX_CONCURRENT_WORKFLOWS**: Concurrent workflow limit

## Deployment Strategy

### Local Development
- Clone repository and install dependencies via pip
- Configure environment variables in `.env` file
- Run bot using `python main.py`

### Production Considerations
- **Process Management**: Use process managers like PM2 or systemd
- **Logging**: Comprehensive logging to files and console
- **Error Handling**: Graceful error handling with user-friendly messages
- **Resource Management**: Configurable limits for concurrent workflows

### Discord Setup Requirements
1. Create Discord application and bot in Developer Portal
2. Configure required permissions (channels, threads, slash commands)
3. Invite bot to server with appropriate permissions
4. Set up role hierarchy matching the permission system

The architecture prioritizes modularity, maintainability, and scalability while providing a robust workflow system for Discord communities. The role-based permission system ensures proper access control, while the interactive UI components provide an intuitive user experience.