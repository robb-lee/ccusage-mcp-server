import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration file path
const CONFIG_DIR = path.join(os.homedir(), '.ccusage-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CLAUDE_COMMANDS_DIR = path.join(os.homedir(), '.claude', 'commands', 'robb');
const COMMAND_SOURCE_FILE = path.join(__dirname, 'commands', 'robb', 'send-usage.md');

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

// Check if ccusage is installed
async function checkCCUsage() {
  try {
    const { stdout } = await execAsync('which ccusage');
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

// Install ccusage if not present
async function installCCUsage() {
  console.error('📦 ccusage CLI is required but not found.');
  console.error('Would you like to install it now? (y/n)');
  const install = await question('Install ccusage? ');
  
  if (install.toLowerCase() === 'y' || install.toLowerCase() === 'yes') {
    console.error('Installing ccusage globally...');
    try {
      await execAsync('npm install -g ccusage');
      console.error('✅ ccusage installed successfully!');
      return true;
    } catch (error) {
      console.error('❌ Failed to install ccusage:', error.message);
      console.error('Please install manually: npm install -g ccusage');
      return false;
    }
  } else {
    console.error('⚠️  ccusage is required. Please install it manually: npm install -g ccusage');
    return false;
  }
}

// Interactive menu for existing users
async function showUpdateMenu() {
  console.error('\n🚀 CCUsage MCP Server');
  console.error('Configuration found. What would you like to do?\n');
  
  console.error('1) 🔄 Update command files to latest version');
  console.error('2) ⚙️  Reconfigure settings (change webhook/username)');
  console.error('3) 🗑️  Reset configuration and setup again\n');
  
  const choice = await question('Choose (1-3): ');
  
  switch (choice.trim()) {
    case '1':
      console.error('\n🔄 Updating command files...');
      await installClaudeCommand();
      console.error('\n✅ Command files updated! You can now use /robb:send-usage with the latest version.');
      break;
      
    case '2':
      console.error('\n⚙️  Starting reconfiguration...');
      return await runFreshSetup(); // Will return new config
      
    case '3':
      console.error('\n🗑️  Resetting configuration...');
      // Delete config file
      try {
        if (fs.existsSync(CONFIG_FILE)) {
          fs.unlinkSync(CONFIG_FILE);
          console.error('✅ Configuration deleted.');
        }
      } catch (error) {
        console.error('⚠️  Could not delete config file:', error.message);
      }
      return await runFreshSetup(); // Will return new config
      
    default:
      console.error('❌ Invalid choice. Exiting...');
      rl.close();
      process.exit(0);
  }
  
  rl.close();
  process.exit(0); // Exit after menu operations
}

// Run fresh setup (extracted from interactiveSetup)
async function runFreshSetup() {
  console.error('\n🚀 CCUsage MCP Server Setup\n');
  console.error('This setup will help you configure the MCP server.\n');

  // Check dependencies first
  console.error('Step 0: Checking dependencies...');
  const hasCCUsage = await checkCCUsage();
  if (!hasCCUsage) {
    const installed = await installCCUsage();
    if (!installed) {
      console.error('\n❌ Setup cannot continue without ccusage.');
      rl.close();
      process.exit(1);
    }
  } else {
    console.error('✅ ccusage is installed');
  }

  const config = {};

  // Ask for webhook URL
  console.error('\nStep 1: n8n Webhook Configuration');
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

  // Install Claude command
  console.error('\nStep 3: Installing Claude Command');
  await installClaudeCommand();

  rl.close();
  return config;
}

// Interactive setup (now calls showUpdateMenu if config exists)
async function interactiveSetup() {
  // Check if config already exists - show menu regardless of TTY
  if (hasConfig()) {
    return await showUpdateMenu();
  }
  
  // No config exists, run fresh setup
  return await runFreshSetup();
}

// Get configuration with priority:
// 1. Environment variables (from Claude config)
// 2. Config file
// 3. Interactive prompt
export async function getConfig() {
  // Check if running in setup mode OR running via npx directly
  const args = process.argv.slice(2);
  const isSetupMode = args.includes('--setup') || args.includes('setup');
  const isNpxExecution = process.argv[1] && process.argv[1].includes('/_npx/');
  const isDirectExecution = process.stdin.isTTY || isNpxExecution;
  
  if (isSetupMode || (isDirectExecution && !process.env.MCP_MODE)) {
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
  if (isDirectExecution) {
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

// Install Claude command file
export async function installClaudeCommand() {
  try {
    // Check if source file exists
    if (!fs.existsSync(COMMAND_SOURCE_FILE)) {
      console.error('⚠️  Command file not found, skipping command installation');
      return;
    }

    // Create commands directory if it doesn't exist
    if (!fs.existsSync(CLAUDE_COMMANDS_DIR)) {
      fs.mkdirSync(CLAUDE_COMMANDS_DIR, { recursive: true });
      console.error('📁 Created Claude commands directory: ~/.claude/commands/robb');
    }

    // Copy the command file
    const targetFile = path.join(CLAUDE_COMMANDS_DIR, 'send-usage.md');
    fs.copyFileSync(COMMAND_SOURCE_FILE, targetFile);
    console.error('✅ Installed /robb:send-usage command to Claude');
    console.error('\n📝 You can now use /robb:send-usage in Claude to send your token usage!');
  } catch (error) {
    console.error('⚠️  Could not install Claude command:', error.message);
    console.error('   You can manually copy commands/robb/send-usage.md to ~/.claude/commands/robb/');
  }
}