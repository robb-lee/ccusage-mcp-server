---
name: send-usage
description: "Send today's Claude token usage data to team spreadsheet"
category: monitoring
complexity: simple
mcp-servers: [ccusage-tracker]
---

# /robb:send-usage - Send today's token usage to team spreadsheet

> **Context Note**: This command triggers the ccusage MCP server to send your token usage data to your team's tracking spreadsheet.

## Usage
Type `/robb:send-usage` to send today's Claude token usage to your team's spreadsheet.

## What happens when you use this command
1. Fetches today's token usage from ccusage CLI
2. Sends the data to your configured n8n webhook
3. Automatically adds a row to your team's Google Sheets
4. Returns confirmation with detailed usage summary

## Instructions for Claude
When the user types `/robb:send-usage`, you should:

1. **Execute**: Use the `send-usage` tool from the `ccusage-tracker` MCP server
2. **Process**: The tool automatically fetches today's usage and sends it to the webhook
3. **Display**: Show the response with the sent data summary

### Success Response Format
```
✅ Usage data sent successfully!
- Date: 2024-01-15
- Total tokens: 150,000
- Cost: $2.25
- Models used: claude-3-opus, claude-3-sonnet
```

### Error Handling
If an error occurs, systematically check:

1. **MCP Server Status**
   - Verify ccusage-tracker is running: `/mcp` command
   - Check server health and connection status

2. **Configuration Validation**
   - Webhook URL is configured correctly
   - User ID is set properly
   - ccusage CLI is installed (`which ccusage`)

3. **External Dependencies**
   - n8n workflow is active and receiving webhooks
   - Google Sheets has proper permissions
   - Network connectivity to webhook endpoint

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| MCP server not found | Run `npm run setup` in the project directory |
| ccusage not installed | Install with `npm install -g ccusage` |
| Webhook fails | Verify n8n workflow is active and URL is correct |
| No usage data | Ensure ccusage has been tracking (check with `ccusage --today`) |