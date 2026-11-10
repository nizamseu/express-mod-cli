/**
 * Express Mod CLI - Main Entry Point
 * A command-line tool to generate Express.js applications with modular architecture
 *
 * Author: Nizam Uddin
 * License: MIT
 */

const { run } = require("./commands/commandRouter");
const { CliError } = require("./utils/errors");

/**
 * Main CLI function
 * @param {string[]} [args] - Command line arguments (defaults to the process arguments)
 */
function main(args = process.argv.slice(2)) {
  try {
    run(args);
  } catch (error) {
    if (error instanceof CliError) {
      // Expected problems (bad input, wrong directory, ...): show the message only
      console.error(error.message);
    } else {
      console.error("CLI Error:", error);
    }
    process.exitCode = 1;
  }
}

module.exports = { main };
