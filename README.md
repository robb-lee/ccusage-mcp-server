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

### 2. Add to Claude Code
```bash
claude mcp add ccusage-tracker -- npx -y @robb-lee/ccusage-mcp-server@latest
```

### 3. Usage
In Claude Code, use the tool:
```
Send my token usage to the spreadsheet
```

Or with a note:
```
Send my token usage with note "Working on project X"
```

Done! Your usage data will be sent to the team spreadsheet automatically.