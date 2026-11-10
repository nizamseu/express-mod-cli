/**
 * An error whose message is meant to be shown to the user as-is
 * (bad input, wrong directory, ...), without a stack trace.
 */
class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliError";
  }
}

module.exports = { CliError };
