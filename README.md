# Discord Workflow Bot

A Discord bot with role-based workflow system featuring embed messages, button interactions, thread creation, and channel management.

## Features

- **Slash Commands**: Modern Discord integration with slash commands
- **Role-Based Permissions**: Multi-tier permission system (Admin, Manager, User)
- **Interactive Embeds**: Rich embed messages with button interactions
- **Thread Management**: Automatic thread creation for workflow processes
- **Channel Creation**: Dynamic channel creation upon workflow completion
- **Permission Verification**: Role-based access control throughout the workflow
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Logging**: Detailed logging for workflow tracking and debugging

## Installation

1. Clone this repository or download the files
2. Install the required dependencies:
   ```bash
   pip install discord.py python-dotenv
   ```
3. Copy `.env.example` to `.env` and configure your settings:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file with your bot configuration:
   - `DISCORD_BOT_TOKEN`: Your Discord bot token
   - Configure other settings as needed

## Setup

### Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token to your `.env` file
4. Enable the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Manage Channels
   - Manage Threads
   - Create Public Threads
   - Embed Links
   - Read Message History

### Server Setup

1. Invite the bot to your Discord server with the required permissions
2. Create the following roles (or use existing ones):
   - `Workflow Admin` or `Admin` - Full workflow permissions
   - `Workflow Manager` or `Manager` - Can verify roles and manage workflows
   - `Workflow User` or `Member` - Basic workflow participation
3. Run the `/setup-roles` command to configure role mappings (optional)

## Usage

### Slash Commands

- `/workflow [channel] [title] [description]` - Start a new workflow process
- `/setup-roles <admin_role> <manager_role> <user_role>` - Configure workflow roles
- `/workflow-status` - Check bot and workflow system status

### Workflow Process

1. **Initiate**: Use `/workflow` command to create a workflow embed
2. **Start**: Click "Start Process" button to create a workflow thread
3. **Verify**: Complete role verification in the created thread
4. **Complete**: Create a new channel upon successful verification

### Permissions

- **Admin**: Can setup roles, start workflows, and manage all aspects
- **Manager**: Can start workflows, verify roles, and manage threads
- **User**: Can participate in workflows (with proper roles)

## Configuration

The bot uses environment variables for configuration. Key settings include:

- `WORKFLOW_TIMEOUT`: How long workflows stay active (default: 600 seconds)
- `MAX_CONCURRENT_WORKFLOWS`: Maximum simultaneous workflows (default: 10)
- `ENABLE_THREAD_CREATION`: Enable/disable thread creation (default: true)
- `ENABLE_CHANNEL_CREATION`: Enable/disable channel creation (default: true)

## File Structure

