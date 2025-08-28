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
  // Remove debug logs for cleaner MCP operation
  
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

  // Get today's date in the format used by ccusage (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];

  // Look for table rows - find lines that contain today's date
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip table borders and headers
    if (!trimmed || trimmed.startsWith('┌') || trimmed.startsWith('├') || 
        trimmed.startsWith('└') || trimmed.startsWith('│ Date') ||
        trimmed.includes('━')) {
      continue;
    }

    // Look for today's data - check if line contains today's date
    if (trimmed.includes(today) || trimmed.includes(today.replace(/-/g, '-').substring(5))) {
      // Debug: Found today row
      
      // Split by │ and clean up the data
      const columns = trimmed.split('│').map(col => col.trim()).filter(col => col);
      
      if (columns.length >= 8) {
        // Parse numeric values, removing commas
        const parseNumber = (str) => {
          const cleaned = str.replace(/[,$]/g, '');
          return parseInt(cleaned, 10) || 0;
        };
        
        const parseFloat = (str) => {
          const cleaned = str.replace(/[$,]/g, '');
          return parseFloat(cleaned) || 0;
        };

        // Extract values from table columns
        data.inputTokens = parseNumber(columns[2]); // Input column
        data.outputTokens = parseNumber(columns[3]); // Output column
        data.cacheCreationInputTokens = parseNumber(columns[4]); // Cache Create column
        data.cacheReadInputTokens = parseNumber(columns[5]); // Cache Read column
        data.totalTokens = parseNumber(columns[6]); // Total Tokens column
        data.totalCost = parseFloat(columns[7]); // Cost column
        
        // Extract model info from second column if available
        if (columns[1]) {
          const modelText = columns[1];
          if (modelText.includes('-')) {
            const models = modelText.split('\n').filter(m => m.trim().startsWith('- '));
            models.forEach(model => {
              const cleanModel = model.replace('- ', '').trim();
              if (cleanModel) {
                data.models[cleanModel] = data.totalTokens; // Approximate, since we don't have per-model breakdown
              }
            });
          }
        }
        
        // Debug: Parsed data
        break; // Found today's data, stop looking
      }
    }
  }

  // If no data found, try to find "Total" row as fallback
  if (data.totalTokens === 0) {
    // No today data found, looking for Total row
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('Total') && trimmed.includes('│')) {
        // Debug: Found total row
        
        const columns = trimmed.split('│').map(col => col.trim()).filter(col => col);
        if (columns.length >= 8) {
          const parseNumber = (str) => {
            const cleaned = str.replace(/[,$]/g, '');
            return parseInt(cleaned, 10) || 0;
          };
          
          const parseFloat = (str) => {
            const cleaned = str.replace(/[$,]/g, '');
            return parseFloat(cleaned) || 0;
          };

          data.inputTokens = parseNumber(columns[2]);
          data.outputTokens = parseNumber(columns[3]);
          data.cacheCreationInputTokens = parseNumber(columns[4]);
          data.cacheReadInputTokens = parseNumber(columns[5]);
          data.totalTokens = parseNumber(columns[6]);
          data.totalCost = parseFloat(columns[7]);
          
          // Debug: Parsed total data
          break;
        }
      }
    }
  }

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
      // Executing ccusage command...
      let ccusageOutput;
      
      try {
        const { stdout, stderr } = await execAsync('ccusage --today');
        if (stderr) {
          // Debug: ccusage stderr available
        }
        ccusageOutput = stdout;
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ccusage: ${error.message}. Make sure ccusage is installed and configured.`
        );
      }

      // Parse the output
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
      // Error in send-usage - will be thrown to handler
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
  // Load configuration (will only show interactive menu if --setup flag is present)
  globalConfig = await getConfig();
  
  // If setup mode, exit after configuration  
  const args = process.argv.slice(2);
  if (args.includes('--setup') || args.includes('setup')) {
    // Command installation happens in config.js during setup
    // Setup mode messages are shown in config.js
    process.exit(0);
  }
  
  // Always start MCP server (no TTY checks)
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Silent operation - no console logs in server mode
}

main().catch((error) => {
  // Silent exit in MCP mode - don't output to stderr
  process.exit(1);
});