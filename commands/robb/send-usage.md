# /robb:send-usage - Send today's token usage to team spreadsheet

> **Context Note**: This command triggers the ccusage MCP server to send your token usage data.

## Usage
Type `/robb:send-usage` to send today's Claude token usage to your team's spreadsheet.

## What happens when you use this command
1. Gets your today's token usage from ccusage CLI
2. Sends the data to your configured n8n webhook
3. Adds a row to your Google Sheets
4. Shows confirmation with usage summary

## Instructions for Claude
When the user types `/robb:send-usage`, you should:

1. Use the send-usage tool from the ccusage-tracker MCP server to send token usage data
2. The tool will automatically get today's usage and send it
3. Display the response showing what was sent

Example response format:
```
✅ Usage data sent successfully!
- Date: 2024-01-15
- Total tokens: 150,000
- Cost: $2.25
- Models used: claude-3-opus, claude-3-sonnet
```

If there's an error, help troubleshoot by checking:
- Is the ccusage-tracker MCP server running? (check with /mcp)
- Is the webhook URL configured correctly?
- Is the n8n workflow active?