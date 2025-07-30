# Discord 10K Robux Giveaway Bot

## Overview

This is a sophisticated Discord bot for managing a 10K Robux giveaway system with comprehensive invite tracking, verification processes, and reward claiming. The bot features a blue Discord theme, PostgreSQL database integration for persistent invite tracking, private thread workflows, and external verification with invite-based bypass options.

## User Preferences

Preferred communication style: Simple, everyday language.
Design theme: Blue Discord color scheme (#5865F2) throughout all embeds
Privacy requirement: All interactions must remain private/ephemeral to users only

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

### Reward Claiming Process
1. **Setup**: Admin executes `/claim-reward` slash command
2. **Role Check**: System verifies user has role `1398018785461538878` to claim
3. **Private Thread**: Bot creates private thread for user
4. **Verification**: User must have role `1398018753542881520` (verified) to proceed
5. **Reward Channel**: Upon verification, exclusive private channel is created

### Invite Checking Process
1. **Setup**: Admin executes `/invite-check` slash command
2. **User Check**: User clicks "Check My Invites" button
3. **Private Response**: Bot shows invite count (1 if has role, 0 if not) privately
4. **Status Display**: Shows eligibility and guidance based on current status

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

## Recent Changes

**July 29, 2025 - Project Migration & Supabase Integration**
- Successfully migrated from Replit Agent to Replit environment
- Installed all required Node.js packages (discord.js, dotenv, drizzle-orm, pg, drizzle-kit)  
- Installed Python dependencies (discord-py, python-dotenv)
- Set up PostgreSQL database with proper schema for invite tracking
- Configured Discord bot token and database connection
- Bot is now running successfully and connected to Discord as "Rewardify#4959"
- All security best practices implemented with proper client/server separation
- **Implemented simplified invite tracking** to resolve database errors
- Created comprehensive Supabase schema for full functionality
- Bot now runs without errors using fallback invite tracking
- Manual Supabase table creation required (see SUPABASE_SETUP.md)

## Recent Changes

**July 30, 2025 - Bug Fixes & Simplified Logging**
- **Fixed invite remove command** - removeInvites method now works with Supabase database
- **Fixed leave tracking bug** - users leaving/rejoining now properly maintain invite counts
- **Simplified join/leave logs** - clean user messages instead of complex embeds
- **Fixed /set-log-channel command** - now properly saves to guild_config table
- **Resolved console errors** - all missing methods implemented and functional
- **Improved user experience** - cleaner logging that's easier to read and understand

**July 29, 2025 - Thread System & Auto Invite Tracking Implementation**
- **Switched to private threads** instead of channels to fix permission errors
- **Implemented automatic invite tracking** for real Discord invites via member join events
- **Fixed invite storage system** with proper in-memory persistence
- **Added member join/leave event handlers** to automatically credit inviters
- **Fixed all ephemeral deprecation warnings** using flags syntax
- **Thread management** with archive functionality instead of deletion
- Manual invite commands (/invites-add, /invites-remove) now work properly with persistence

**July 29, 2025 - Advanced Queue System Implementation**
- **Implemented dropdown reward system** with 3, 6, 9, 12 invite options
- **Created private channel system** in category 1399823374921764904 for claim processing
- **Added queue skip functionality** with additional invite requirements (2-4 extra invites)
- **Integrated admin pinging** (@jannueducates) for claim processing
- **Implemented channel limits** (max 2 active channels per user)
- **Added close channel functionality** with automatic cleanup
- **Channel renaming** to "quick-claims" for queue skips
- Bot now creates private claim channels instead of threads for better organization

**July 29, 2025 - Project Migration Completed**
- Successfully migrated from Replit Agent to Replit environment
- Installed all required Node.js packages (discord.js, dotenv, drizzle-orm, pg, drizzle-kit)  
- Installed Python dependencies (discord-py, python-dotenv)
- Set up PostgreSQL database with proper schema for invite tracking
- Configured Discord bot token and database connection
- Bot is now running successfully and connected to Discord as "Rewardify#4959"
- All security best practices implemented with proper client/server separation