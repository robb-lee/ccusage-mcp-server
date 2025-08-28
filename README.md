# CCUsage MCP Server

Track Claude token usage and send to team spreadsheet automatically.

## Quick Start

### 1. Setup
```bash
npx -y @robb-lee/ccusage-mcp-server@latest --setup
```

When prompted, enter:
- **n8n Webhook URL**: Your team's webhook URL (from n8n workflow)
- **Your Name**: Your name for tracking in the spreadsheet

The setup will automatically:
- Install required dependencies (ccusage CLI)
- Configure webhook and user settings
- Install the `/robb:send-usage` command
- Add the MCP server to Claude Code

### 2. Usage
In Claude Code, use the command:
```
/robb:send-usage
```

Or with a note:
```
/robb:send-usage "Working on project X"
```

Done! Your usage data will be sent to the team spreadsheet automatically.

## Manual Installation (if automatic setup fails)

If the automatic MCP server installation fails, you can add it manually:
```bash
claude mcp add ccusage-tracker -s user -- npx -y @robb-lee/ccusage-mcp-server@latest
```