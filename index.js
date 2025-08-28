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

// Helper function to strip ANSI color codes
function stripAnsiCodes(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Helper function to parse ccusage output
function parseCCUsageOutput(output) {
  // Remove ANSI color codes for cleaner parsing
  const cleanOutput = stripAnsiCodes(output);
  
  const lines = cleanOutput.split('\n');
  const data = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalCost: 0,
    models: {}
  };

  // Get today's date in local timezone (not UTC) to match system time
  const localDate = new Date();
  const year = String(localDate.getFullYear());  // e.g., "2025"
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;  // e.g., "2025-08-29"
  const monthDay = `${month}-${day}`;  // e.g., "08-29"
  
  console.error(`[DEBUG] Looking for date: ${today} (year: ${year}, month-day: ${monthDay})`);

  // Look for table rows - need to check consecutive lines for split dates
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip table borders and headers
    if (!trimmed || trimmed.startsWith('┌') || trimmed.startsWith('├') || 
        trimmed.startsWith('└') || trimmed.startsWith('│ Date') ||
        trimmed.includes('━') || trimmed.includes('─')) {
      continue;
    }

    // Check if this line contains today's date
    // Handle both compact mode (date split across lines) and wide mode (full date in one line)
    if (trimmed.includes('│')) {
      // Get the columns from this line
      const columns = trimmed.split('│').map(col => col.trim()).filter(col => col);
      if (columns.length > 0) {
        const dateColumn = columns[0];
        const nextLine = lines[i + 1]?.trim() || '';
        
        // Check for wide mode: full date in one column
        if (dateColumn === today || dateColumn.includes(today)) {
          // Found today's data in wide mode
          console.error(`[DEBUG] Found today's data (wide mode): ${trimmed.substring(0, 80)}...`);
          
          // In wide/regular mode, check we have enough columns
          if (columns.length >= 5) {
            // Parse numeric values, removing commas
            const parseNumberValue = (str) => {
              const cleaned = str.replace(/[,$]/g, '');
              return parseInt(cleaned, 10) || 0;
            };
            
            const parseFloatValue = (str) => {
              const cleaned = str.replace(/[$,]/g, '');
              return parseFloat(cleaned) || 0;
            };

            // Extract values from table columns
            // In compact mode: Date | Models | Input | Output | Cost
            // Regular mode: Date | Models | Input | Output | Cache Create | Cache Read | Total | Cost
            if (columns.length === 5) {
              // Compact mode
              data.inputTokens = parseNumberValue(columns[2]); // Input column
              data.outputTokens = parseNumberValue(columns[3]); // Output column
              data.totalCost = parseFloatValue(columns[4]); // Cost column
              // Calculate total tokens (no cache info in compact mode)
              data.totalTokens = data.inputTokens + data.outputTokens;
            } else {
              // Wide/regular mode with all columns
              data.inputTokens = parseNumberValue(columns[2]); // Input column
              data.outputTokens = parseNumberValue(columns[3]); // Output column
              data.cacheCreationInputTokens = parseNumberValue(columns[4]); // Cache Create column
              data.cacheReadInputTokens = parseNumberValue(columns[5]); // Cache Read column
              data.totalTokens = parseNumberValue(columns[6]); // Total Tokens column
              data.totalCost = parseFloatValue(columns[7]); // Cost column
            }
            
            console.error(`[DEBUG] Parsed data from today's row:`);
            console.error(`[DEBUG]   Input: ${data.inputTokens}, Output: ${data.outputTokens}`);
            console.error(`[DEBUG]   Cache Create: ${data.cacheCreationInputTokens}, Cache Read: ${data.cacheReadInputTokens}`);
            console.error(`[DEBUG]   Total: ${data.totalTokens}, Cost: $${data.totalCost}`);
            
            // Extract model info from second column - check multiple lines for same date
            if (columns[1]) {
              // Collect all models from current and subsequent lines with same date
              let allModelLines = [];
              let checkLineIndex = i;
              
              // Add current line's model
              if (columns[1].trim()) {
                allModelLines.push(columns[1]);
              }
              
              // Check next lines for same date (models can span multiple rows)
              while (checkLineIndex < lines.length - 1) {
                checkLineIndex++;
                const nextCheckLine = lines[checkLineIndex];
                
                // Stop if we hit a separator or new date row
                if (!nextCheckLine || nextCheckLine.includes('├') || 
                    nextCheckLine.includes('└') || nextCheckLine.includes('Total')) {
                  break;
                }
                
                // Parse columns from next line
                if (nextCheckLine.includes('│')) {
                  const nextCols = nextCheckLine.split('│').map(col => col.trim()).filter(col => col);
                  
                  // Check if this line has model info in second column
                  if (nextCols.length >= 2 && nextCols[1] && nextCols[1].includes('-')) {
                    // Check if it's the same date continuation (date part in first column)
                    if (nextCols[0] === monthDay || nextCols[0].includes(monthDay) || !nextCols[0] || nextCols[0] === '') {
                      allModelLines.push(nextCols[1]);
                    }
                  } 
                  // Check if model is in first column (for different table formats)
                  else if (nextCols.length >= 1 && nextCols[0] && nextCols[0].includes('-')) {
                    allModelLines.push(nextCols[0]);
                  } else {
                    // New date row or no model info, stop
                    break;
                  }
                }
              }
              
              // Parse all collected model lines
              allModelLines.forEach(modelLine => {
                if (modelLine.includes('-')) {
                  // Extract models using regex to handle both "- model" format
                  const modelMatches = modelLine.match(/- ([^\s]+)/g);
                  if (modelMatches) {
                    modelMatches.forEach(match => {
                      const cleanModel = match.replace('- ', '').trim();
                      if (cleanModel) {
                        data.models[cleanModel] = data.totalTokens; // Approximate, since we don't have per-model breakdown
                      }
                    });
                  }
                }
              });
              
              console.error(`[DEBUG] Extracted models: ${JSON.stringify(Object.keys(data.models))}`);
            }
            
            break; // Found today's data, stop looking
          }
        }
        // Check for compact mode: year in this line, month-day in next line  
        else if (dateColumn === year || dateColumn.includes(year)) {
          // Check if next line contains the month-day part
          const nextColumns = nextLine.split('│').map(col => col.trim()).filter(col => col);
          
          console.error(`[DEBUG] Checking compact mode:`);
          console.error(`[DEBUG]   Date column: "${dateColumn}" vs year: "${year}"`);
          console.error(`[DEBUG]   Next line first column: "${nextColumns[0]}" vs monthDay: "${monthDay}"`);
          
          if (nextColumns.length > 0 && (nextColumns[0] === monthDay || nextColumns[0].includes(monthDay))) {
            console.error(`[DEBUG] Found today's data (compact mode):`);
            console.error(`[DEBUG]   Year line: ${trimmed.substring(0, 80)}...`);
            console.error(`[DEBUG]   Month-day line: ${nextLine.substring(0, 80)}...`);
            
            // Parse data from current line (which has the actual numbers)
            if (columns.length >= 5) {
              const parseNumberValue = (str) => {
                const cleaned = str.replace(/[,$]/g, '');
                return parseInt(cleaned, 10) || 0;
              };
              
              const parseFloatValue = (str) => {
                const cleaned = str.replace(/[$,]/g, '');
                return parseFloat(cleaned) || 0;
              };

              // In compact mode parsing
              data.inputTokens = parseNumberValue(columns[2]);
              data.outputTokens = parseNumberValue(columns[3]);
              data.cacheCreationInputTokens = parseNumberValue(columns[4]);
              data.cacheReadInputTokens = parseNumberValue(columns[5]);
              data.totalTokens = parseNumberValue(columns[6]);
              data.totalCost = parseFloatValue(columns[7]);
              
              console.error(`[DEBUG] Parsed data from compact mode:`);
              console.error(`[DEBUG]   Input: ${data.inputTokens}, Output: ${data.outputTokens}`);
              console.error(`[DEBUG]   Total: ${data.totalTokens}, Cost: $${data.totalCost}`);
              
              // Extract model info - check multiple lines for same date
              if (columns[1]) {
                // Collect all models from current and subsequent lines with same date
                let allModelLines = [];
                let checkLineIndex = i;
                
                // Add current line's model
                if (columns[1].trim()) {
                  allModelLines.push(columns[1]);
                }
                
                // Check next lines for same date (models can span multiple rows)
                while (checkLineIndex < lines.length - 1) {
                  checkLineIndex++;
                  const nextCheckLine = lines[checkLineIndex];
                  
                  // Stop if we hit a separator or new date row
                  if (!nextCheckLine || nextCheckLine.includes('├') || 
                      nextCheckLine.includes('└') || nextCheckLine.includes('Total')) {
                    break;
                  }
                  
                  // Parse columns from next line
                  if (nextCheckLine.includes('│')) {
                    const nextCols = nextCheckLine.split('│').map(col => col.trim()).filter(col => col);
                    
                    // Check if this line has model info in second column
                    if (nextCols.length >= 2 && nextCols[1] && nextCols[1].includes('-')) {
                      // Check if it's the same date continuation (date part in first column)
                      if (nextCols[0] === monthDay || nextCols[0].includes(monthDay) || !nextCols[0] || nextCols[0] === '') {
                        allModelLines.push(nextCols[1]);
                      }
                    } 
                    // Check if model is in first column (for different table formats)
                    else if (nextCols.length >= 1 && nextCols[0] && nextCols[0].includes('-')) {
                      allModelLines.push(nextCols[0]);
                    } else {
                      // New date row or no model info, stop
                      break;
                    }
                  }
                }
                
                // Parse all collected model lines
                allModelLines.forEach(modelLine => {
                  if (modelLine.includes('-')) {
                    // Extract models using regex to handle both "- model" format
                    const modelMatches = modelLine.match(/- ([^\s]+)/g);
                    if (modelMatches) {
                      modelMatches.forEach(match => {
                        const cleanModel = match.replace('- ', '').trim();
                        if (cleanModel) {
                          data.models[cleanModel] = data.totalTokens;
                        }
                      });
                    }
                  }
                });
                
                console.error(`[DEBUG] Extracted models: ${JSON.stringify(Object.keys(data.models))}`);
              }
              
              break; // Found today's data, stop looking
            }
          }
        }
      }
    }
  }

  // If no data found, return error instead of using Total row
  if (data.totalTokens === 0) {
    console.error(`[DEBUG] No data found for today (${today})`);
    console.error(`[DEBUG] Available dates in ccusage output need to be checked`);
    
    // Return data with error flag instead of using Total
    data.error = `No usage data found for ${today}. Please check if you have used Claude Code today.`;
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
      console.error('[DEBUG] Executing ccusage --today command...');
      let ccusageOutput;
      
      try {
        const { stdout, stderr } = await execAsync('ccusage --today --no-color');
        if (stderr) {
          console.error(`[DEBUG] ccusage stderr: ${stderr}`);
        }
        ccusageOutput = stdout;
        console.error(`[DEBUG] ccusage output length: ${ccusageOutput.length} chars`);
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ccusage: ${error.message}. Make sure ccusage is installed and configured.`
        );
      }

      // Parse the output
      const usageData = parseCCUsageOutput(ccusageOutput);
      console.error(`[DEBUG] Final parsed data:`);
      console.error(`[DEBUG]   Total tokens: ${usageData.totalTokens}`);
      console.error(`[DEBUG]   Input/Output: ${usageData.inputTokens}/${usageData.outputTokens}`);
      console.error(`[DEBUG]   Cost: $${usageData.totalCost}`);
      
      // Check if parsing found an error
      if (usageData.error) {
        throw new McpError(
          ErrorCode.InternalError,
          usageData.error
        );
      }

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
  
  // Output startup message to stderr for Claude Code to detect
  // This is the standard pattern used by other MCP servers
  console.error('CCUsage MCP Server running on stdio');
}

main().catch((error) => {
  // Silent exit in MCP mode - don't output to stderr
  process.exit(1);
});