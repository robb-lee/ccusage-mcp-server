# CCUsage MCP Server

Track and share Claude token usage automatically via n8n and Google Sheets.

## 🚀 Quick Start

```bash
# Run setup (automatically starts if no config exists)
npx @robb-lee/ccusage-mcp-server

# Add to Claude Code
claude mcp add ccusage-tracker npx @robb-lee/ccusage-mcp-server

# Verify installation
claude mcp list
```

## 🎯 Overview

This MCP (Model Context Protocol) server allows Claude Code users to:
- Track their daily token usage with a simple command
- Automatically send usage data to a team spreadsheet
- Monitor costs and usage patterns across multiple users

## 🏗️ Architecture

```
[Local Machine]                    [Central Server]
Claude Code                        n8n Instance
     ↓                                  ↑
MCP Server      ---HTTP POST--->   Webhook
     ↓                                  ↓
ccusage CLI                       Google Sheets
```

## 📦 Installation

### Prerequisites

1. **ccusage** CLI tool installed
   ```bash
   npm install -g ccusage
   ```

2. **Node.js** 18.0.0 or higher

3. **n8n instance** (self-hosted or cloud)

4. **Google Sheets** with appropriate permissions

### Step 1: Install MCP Server

#### Option A: Install from npm (Recommended)
```bash
# Install globally
npm install -g @robb-lee/ccusage-mcp-server

# Run setup to configure
ccusage-mcp-server --setup
```

#### Option B: Use with npx (No installation)
```bash
# Run directly with npx (automatically starts setup if no config exists)
npx @robb-lee/ccusage-mcp-server
```

#### Option C: Install from source
```bash
# Clone repository
git clone <repository-url> ccusage-mcp-server
cd ccusage-mcp-server

# Install dependencies
npm install

# Run setup
npm run setup
```

### Step 2: Setup n8n Workflow

1. Import `n8n-workflow.json` into your n8n instance
2. Configure the Google Sheets node:
   - Set your Google Sheet ID
   - Configure OAuth2 credentials
   - Create a sheet named "Usage Data" with columns:
     - User, Date, Time, Timestamp, Total Tokens, Input Tokens, Output Tokens, Cache Creation, Cache Read, Cost ($), Models Used, Note

3. Activate the workflow and copy the webhook URL

### Step 3: Configure Claude Code

Claude Code uses MCP CLI commands to add servers:

#### Option A: If installed globally (Recommended)
```bash
# Add the MCP server to Claude Code
claude mcp add ccusage-tracker ccusage-mcp-server

# Or with custom environment variables
claude mcp add ccusage-tracker ccusage-mcp-server \
  -e N8N_WEBHOOK_URL=https://your-n8n.com/webhook/ccusage-tracker \
  -e CCUSAGE_USER_ID=your_name
```

#### Option B: If using npx
```bash
# Add using npx
claude mcp add ccusage-tracker npx @robb-lee/ccusage-mcp-server
```

#### Option C: Add for entire project (team sharing)
```bash
# Add to project (creates .mcp.json)
claude mcp add --scope project ccusage-tracker ccusage-mcp-server
```

#### Managing MCP Servers
```bash
# List all configured MCP servers
claude mcp list

# Get details of specific server
claude mcp get ccusage-tracker

# Remove server if needed
claude mcp remove ccusage-tracker
```

### Step 4: Verify Installation

1. Run `claude mcp list` to confirm the server is added
2. Restart Claude Code if already running
3. In Claude Code, use `/mcp` command to see available servers

## 🚀 Usage

In Claude Code, you can verify MCP servers and use them:

```bash
# Check available MCP servers
/mcp
```

Then use the MCP tool:

```
Use the send-usage tool to send my token usage to the spreadsheet
```

Or with a note:

```
Send my token usage with note "Working on project X"
```

The tool will:
1. Run ccusage to get today's usage
2. Send the data to your n8n webhook
3. n8n will add a row to your Google Sheet
4. Return a confirmation with usage summary

## 🔧 Configuration

### Configuration Priority

The MCP server checks for configuration in this order:
1. **Environment variables** (set via `claude mcp add -e KEY=value`)
2. **Config file** (`~/.ccusage-mcp/config.json`)
3. **Interactive setup** (if no config found)

### Configuration Options

| Variable | Description | Required |
|----------|-------------|----------|
| `N8N_WEBHOOK_URL` | Your n8n webhook URL | Yes |
| `CCUSAGE_USER_ID` | Your name for the spreadsheet | No (defaults to system username) |

### Setup Commands

**Note**: When using `npx`, the server automatically enters setup mode if no configuration is found. The `--setup` flag is only needed when installed globally or to reconfigure existing settings.

```bash
# Initial setup with npx (auto-detects no config)
npx @robb-lee/ccusage-mcp-server

# Initial setup with global install
ccusage-mcp-server --setup

# Reconfigure existing settings
ccusage-mcp-server --setup
```

Configuration is saved to `~/.ccusage-mcp/config.json` for future use.

## 🔄 Updating

To update to the latest version and manage your installation:

```bash
# Get the latest version (includes bug fixes and new features)
npx @robb-lee/ccusage-mcp-server@latest
```

If you already have a configuration, you'll see an interactive menu:

```
🚀 CCUsage MCP Server
Configuration found. What would you like to do?

1) 🔄 Update command files to latest version  
2) ⚙️  Reconfigure settings (change webhook/username)
3) 🗑️  Reset configuration and setup again

Choose (1-3):
```

### Update Options

- **Option 1**: Updates `/robb:send-usage` command files to the latest version
- **Option 2**: Change your webhook URL, username, or other settings
- **Option 3**: Delete all configuration and start fresh setup

### For Global Installation Users

```bash
# Update the globally installed package
npm update -g @robb-lee/ccusage-mcp-server

# Then run the update menu
ccusage-mcp-server --setup
```

### n8n Workflow Configuration

The workflow requires:
- Webhook node to receive data
- Function node to validate and format
- Google Sheets node with OAuth2 credentials
- Response nodes for success/error

### Google Sheets Setup

Create a spreadsheet with these columns:
- **User**: Who sent the data
- **Date**: Date of usage
- **Time**: Time of submission
- **Timestamp**: Full timestamp
- **Total Tokens**: Combined token count
- **Input/Output Tokens**: Breakdown
- **Cache Creation/Read**: Cache token usage
- **Cost ($)**: Estimated cost
- **Models Used**: Which models were used
- **Note**: Optional context

## 🛠️ Development

### Run in Development Mode

```bash
npm run dev
```

### Test the MCP Server

```bash
# Test directly
node index.js

# In another terminal
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node index.js
```

## 📊 Team Setup Guide

### For Team Administrators:

1. **Setup Central n8n Instance**
   - Deploy n8n (Docker, npm, or cloud)
   - Import the workflow
   - Configure Google Sheets access
   - Share webhook URL with team

2. **Create Shared Spreadsheet**
   - Create Google Sheet
   - Set permissions for team viewing
   - Share sheet link with team

### For Team Members:

1. **Install ccusage CLI**
   ```bash
   npm install -g ccusage
   ```

2. **Setup MCP server**
   ```bash
   npx @robb-lee/ccusage-mcp-server
   # Automatically starts setup if no config exists
   # Enter your team's webhook URL when prompted
   ```

3. **Add to Claude Code**
   ```bash
   claude mcp add ccusage-tracker npx @robb-lee/ccusage-mcp-server
   ```

4. **Start tracking!**

## 🐛 Troubleshooting

### Common Issues

**"ccusage command not found"**
- Ensure ccusage is installed: `npm install -g ccusage`
- Check PATH includes npm global bin directory

**"N8N_WEBHOOK_URL is not configured"**
- Set the webhook URL in your environment or Claude config

**"Failed to send data to n8n"**
- Verify webhook URL is correct
- Check n8n workflow is active
- Ensure network connectivity

**No data in Google Sheets**
- Check n8n workflow execution logs
- Verify Google Sheets credentials
- Ensure sheet name matches configuration

### Debug Mode

To see detailed logs:
1. Check Claude Code logs
2. View n8n execution history
3. Run MCP server manually to see console output

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues or questions:
- Check the troubleshooting section
- Review n8n workflow logs
- Create an issue in the repository