#!/usr/bin/env node

/**
 * Express Mod CLI - Main Entry Point
 * A command-line tool to generate Express.js applications with modular architecture
 *
 * Author: Nizam Uddin
 * License: MIT
 */

const { handleCommand, validateArgs } = require("./commands/commandRouter");
const messages = require("./utils/messages");

/**
 * Main CLI function
 */
function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);

    // Validate arguments
    if (args.length === 0) {
      console.error(messages.error.noCommand);
      process.exit(1);
    }

    // Parse and validate arguments
    const { command, name } = validateArgs(args);

    // Execute the command
    handleCommand(command, name);
  } catch (error) {
    console.error("CLI Error:", error.message);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = { main };
