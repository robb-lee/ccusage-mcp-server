# CCUsage MCP Server

Track and share Claude token usage automatically via n8n and Google Sheets.

## 🚀 Quick Start

```bash
# Install and setup
npx ccusage-mcp-server --setup

# Add to Claude Desktop config
# Then restart Claude Desktop
```

## 🎯 Overview

This MCP (Model Context Protocol) server allows Claude Desktop users to:
- Track their daily token usage with a simple command
- Automatically send usage data to a team spreadsheet
- Monitor costs and usage patterns across multiple users

## 🏗️ Architecture

```
[Local Machine]                    [Central Server]
Claude Desktop                     n8n Instance
     ↓                                  ↑
MCP Server      ---HTTP POST--->   Webhook
     ↓                                  ↓
ccusage CLI                       Google Sheets
```

## 📦 Installation

### Prerequisites

1. **ccusage** CLI tool installed and configured
   ```bash
   npm install -g ccusage
   ccusage --setup  # Configure with your API key
   ```

2. **Node.js** 18.0.0 or higher

3. **n8n instance** (self-hosted or cloud)

4. **Google Sheets** with appropriate permissions

### Step 1: Install MCP Server

#### Option A: Install from npm (Recommended)
```bash
# Install globally
npm install -g ccusage-mcp-server

# Run setup to configure
ccusage-mcp-server --setup
```

#### Option B: Use with npx (No installation)
```bash
# Run directly with npx
npx ccusage-mcp-server --setup
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

### Step 3: Configure Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### If installed globally:
```json
{
  "mcpServers": {
    "ccusage-tracker": {
      "command": "ccusage-mcp-server"
    }
  }
}
```

#### If using npx:
```json
{
  "mcpServers": {
    "ccusage-tracker": {
      "command": "npx",
      "args": ["ccusage-mcp-server"]
    }
  }
}
```

#### Override configuration (optional):
```json
{
  "mcpServers": {
    "ccusage-tracker": {
      "command": "npx",
      "args": ["ccusage-mcp-server"],
      "env": {
        "N8N_WEBHOOK_URL": "https://your-n8n.com/webhook/ccusage-tracker",
        "CCUSAGE_USER_ID": "your_name"
      }
    }
  }
}
```

### Step 4: Restart Claude Desktop

After configuration, restart Claude Desktop to load the MCP server.

## 🚀 Usage

In Claude Desktop, simply use the MCP tool:

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
1. **Environment variables** (from Claude Desktop config)
2. **Config file** (`~/.ccusage-mcp/config.json`)
3. **Interactive setup** (if no config found)

### Configuration Options

| Variable | Description | Required |
|----------|-------------|----------|
| `N8N_WEBHOOK_URL` | Your n8n webhook URL | Yes |
| `CCUSAGE_USER_ID` | Your name for the spreadsheet | No (defaults to system username) |

### Setup Commands

```bash
# Initial setup
ccusage-mcp-server --setup

# Reconfigure
ccusage-mcp-server --setup
```

Configuration is saved to `~/.ccusage-mcp/config.json` for future use.

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

1. **Install ccusage and configure with your API key**
2. **Clone/download this MCP server**
3. **Configure with team's webhook URL**
4. **Add to Claude Desktop config**
5. **Start tracking!**

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
1. Check Claude Desktop logs
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