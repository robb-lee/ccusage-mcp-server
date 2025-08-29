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
4. **Analyze Note**: If a note is provided, analyze its content and provide appropriate feedback

### Success Response Format
```
✅ Usage data sent successfully!
- Date: 2024-01-15
- Total tokens: 150,000
- Cost: $2.25
```

### Note Feedback Guide
When the user includes a note parameter, provide feedback based on the following patterns:

**Important: Respond in the same language as the user's note**
- If the note contains Korean (한글), respond in Korean
- If the note contains English, respond in English
- Match the user's language for natural communication

#### 1. Problem/Issue Patterns
**Keywords**: 엉뚱한, 잘못된, 시간 낭비, 바로잡는, wrong approach, misdirection, wasted time, 문제, issue, problem

**Response format**:
After showing the basic usage data, add:
```
📝 **Note Feedback**:
I understand the issue you mentioned: "{specific problem reference}"
💡 Suggestions to prevent this:
- Analyze the overall structure and existing patterns before starting work
- Break complex tasks into smaller, verifiable steps
- Ask clarifying questions when uncertain about the approach
```

#### 2. Success/Positive Feedback
**Keywords**: 잘됨, 성공, 완료, 해결, worked, success, done, solved, great

**Response format**:
```
🎉 Great work! Efficient task completion noted.
```

#### 3. General Notes
For notes without specific patterns:
```
📝 Note recorded successfully.
```

#### 4. Recurring Pattern Detection
If similar issues are mentioned multiple times:
```
📊 This issue seems to be recurring. Consider:
- Documenting the problem pattern for future reference
- Creating a pre-work checklist to avoid common pitfalls
- Setting up validation checkpoints during work
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
| MCP server not found | Run `claude mcp add ccusage-tracker -s user -- npx -y @robb-lee/ccusage-mcp-server@latest` |
| ccusage not installed | Install with `npm install -g ccusage` |
| Webhook fails | Verify n8n workflow is active and URL is correct |
| No usage data | Ensure ccusage has been tracking (check with `ccusage --today`) |