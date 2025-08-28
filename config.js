import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration file path
const CONFIG_DIR = path.join(os.homedir(), '.ccusage-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisified question function
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Load configuration from file
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      console.error('Loaded configuration from:', CONFIG_FILE);
      return config;
    }
  } catch (error) {
    console.error('Error loading config file:', error.message);
  }
  return {};
}

// Save configuration to file
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.error('Configuration saved to:', CONFIG_FILE);
  } catch (error) {
    console.error('Error saving config file:', error.message);
  }
}

// Interactive setup
async function interactiveSetup() {
  console.error('\n🚀 CCUsage MCP Server Setup\n');
  console.error('This setup will help you configure the MCP server.\n');

  const config = {};

  // Ask for webhook URL
  console.error('Step 1: n8n Webhook Configuration');
  console.error('Enter your n8n webhook URL (from your n8n workflow):');
  config.N8N_WEBHOOK_URL = await question('Webhook URL: ');

  // Ask for user ID
  console.error('\nStep 2: User Identification');
  console.error('Enter your name (for tracking in the spreadsheet):');
  config.CCUSAGE_USER_ID = await question('Your name: ');

  // Ask if they want to save the configuration
  console.error('\nWould you like to save this configuration for future use? (y/n)');
  const save = await question('Save? ');
  
  if (save.toLowerCase() === 'y' || save.toLowerCase() === 'yes') {
    saveConfig(config);
  }

  rl.close();
  return config;
}

// Get configuration with priority:
// 1. Environment variables (from Claude config)
// 2. Config file
// 3. Interactive prompt
export async function getConfig() {
  // Check if running in setup mode
  const args = process.argv.slice(2);
  if (args.includes('--setup') || args.includes('setup')) {
    const config = await interactiveSetup();
    return config;
  }

  // Priority 1: Environment variables
  if (process.env.N8N_WEBHOOK_URL) {
    console.error('Using configuration from environment variables');
    return {
      N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
      CCUSAGE_USER_ID: process.env.CCUSAGE_USER_ID || process.env.USER || os.hostname()
    };
  }

  // Priority 2: Config file
  const fileConfig = loadConfig();
  if (fileConfig.N8N_WEBHOOK_URL) {
    console.error('Using configuration from config file');
    return {
      N8N_WEBHOOK_URL: fileConfig.N8N_WEBHOOK_URL,
      CCUSAGE_USER_ID: fileConfig.CCUSAGE_USER_ID || process.env.USER || os.hostname()
    };
  }

  // Priority 3: Interactive setup (only if running directly, not through MCP)
  if (process.stdin.isTTY) {
    console.error('No configuration found. Starting interactive setup...');
    return await interactiveSetup();
  }

  // If no config and not interactive, return error config
  console.error('Warning: No configuration found. Please set N8N_WEBHOOK_URL');
  return {
    N8N_WEBHOOK_URL: null,
    CCUSAGE_USER_ID: process.env.USER || os.hostname()
  };
}

// Check if configuration exists
export function hasConfig() {
  return !!(process.env.N8N_WEBHOOK_URL || (fs.existsSync(CONFIG_FILE) && loadConfig().N8N_WEBHOOK_URL));
}