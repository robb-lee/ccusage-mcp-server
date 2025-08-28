#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import os from 'os';
import { getConfig, hasConfig, installClaudeCommand } from './config.js';

const execAsync = promisify(exec);

// Store configuration globally
let globalConfig = null;

// Server configuration
const server = new Server(
  {
    name: 'ccusage-tracker',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to parse ccusage output
function parseCCUsageOutput(output) {
  const lines = output.split('\n');
  const data = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalCost: 0,
    models: {}
  };

  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith('━') || trimmed.includes('Token Usage')) {
      continue;
    }

    // Detect sections
    if (trimmed.includes('Total:')) {
      currentSection = 'total';
    } else if (trimmed.includes('Model Breakdown:')) {
      currentSection = 'models';
    }

    // Parse total section
    if (currentSection === 'total') {
      if (trimmed.includes('Input:')) {
        const match = trimmed.match(/Input:\s*([\d,]+)/);
        if (match) data.inputTokens = parseInt(match[1].replace(/,/g, ''), 10);
      } else if (trimmed.includes('Output:')) {
        const match = trimmed.match(/Output:\s*([\d,]+)/);
        if (match) data.outputTokens = parseInt(match[1].replace(/,/g, ''), 10);
      } else if (trimmed.includes('Cache creation input:')) {
        const match = trimmed.match(/Cache creation input:\s*([\d,]+)/);
        if (match) data.cacheCreationInputTokens = parseInt(match[1].replace(/,/g, ''), 10);
      } else if (trimmed.includes('Cache read input:')) {
        const match = trimmed.match(/Cache read input:\s*([\d,]+)/);
        if (match) data.cacheReadInputTokens = parseInt(match[1].replace(/,/g, ''), 10);
      } else if (trimmed.includes('Cost:')) {
        const match = trimmed.match(/\$([\d.]+)/);
        if (match) data.totalCost = parseFloat(match[1]);
      }
    }

    // Parse model breakdown
    if (currentSection === 'models' && trimmed.includes(':')) {
      const [model, tokens] = trimmed.split(':').map(s => s.trim());
      if (model && tokens) {
        const tokenMatch = tokens.match(/([\d,]+)/);
        if (tokenMatch) {
          data.models[model] = parseInt(tokenMatch[1].replace(/,/g, ''), 10);
        }
      }
    }
  }

  // Calculate total if not already set
  data.totalTokens = data.inputTokens + data.outputTokens + 
                     data.cacheCreationInputTokens + data.cacheReadInputTokens;

  return data;
}

// Tool: send-usage
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'send-usage',
      description: 'Send today\'s Claude token usage to the team spreadsheet via n8n',
      inputSchema: {
        type: 'object',
        properties: {
          note: {
            type: 'string',
            description: 'Optional note or comment about the usage',
          },
        },
      },
    },
  ],
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'send-usage') {
    try {
      // Check if webhook URL is configured
      const webhookUrl = globalConfig.N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new McpError(
          ErrorCode.InternalError,
          'N8N_WEBHOOK_URL is not configured. Please run with --setup flag or set it in your environment.'
        );
      }

      // Execute ccusage command
      console.error('Executing ccusage command...');
      let ccusageOutput;
      
      try {
        const { stdout, stderr } = await execAsync('ccusage --today');
        if (stderr) {
          console.error('ccusage stderr:', stderr);
        }
        ccusageOutput = stdout;
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ccusage: ${error.message}. Make sure ccusage is installed and configured.`
        );
      }

      // Parse the output
      console.error('Parsing ccusage output...');
      const usageData = parseCCUsageOutput(ccusageOutput);

      // Prepare payload
      const payload = {
        user: globalConfig.CCUSAGE_USER_ID || process.env.USER || os.hostname(),
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        note: args?.note || '',
        ...usageData,
        rawOutput: ccusageOutput // Include raw output for debugging
      };

      console.error('Sending data to n8n webhook...');
      console.error('Payload:', JSON.stringify(payload, null, 2));

      // Send to n8n webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to send data to n8n: ${response.status} ${response.statusText}. Response: ${errorText}`
        );
      }

      const responseData = await response.text();
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Token usage data sent successfully!
            
📊 **Summary:**
- Total Tokens: ${usageData.totalTokens.toLocaleString()}
- Input: ${usageData.inputTokens.toLocaleString()}
- Output: ${usageData.outputTokens.toLocaleString()}
- Cache Creation: ${usageData.cacheCreationInputTokens.toLocaleString()}
- Cache Read: ${usageData.cacheReadInputTokens.toLocaleString()}
- Cost: $${usageData.totalCost.toFixed(2)}
- User: ${payload.user}
${args?.note ? `- Note: ${args.note}` : ''}

Response from n8n: ${responseData || 'Success'}`,
          },
        ],
      };
    } catch (error) {
      console.error('Error in send-usage:', error);
      throw error;
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown tool: ${name}`
  );
});

// Start the server
async function main() {
  // Load configuration
  globalConfig = await getConfig();
  
  // If setup mode, exit after configuration
  const args = process.argv.slice(2);
  if (args.includes('--setup') || args.includes('setup')) {
    // Command installation happens in config.js during setup
    console.error('\n✅ Setup complete! You can now use the MCP server.');
    console.error('📝 Use /robb:send-usage in Claude to send your token usage to the spreadsheet!');
    process.exit(0);
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ccusage MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});