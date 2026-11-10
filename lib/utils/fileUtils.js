const fs = require("fs");
const path = require("path");
const { CliError } = require("./errors");

/**
 * Create a file (and its parent directories)
 * @param {string} filePath - The path where the file should be created
 * @param {string} content - The content to write to the file
 */
const createFile = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.trim() + "\n");
};

/**
 * Check that a file exists and contains every given marker comment.
 * Run this before writing anything, so a command either fully applies or not at all.
 * @param {string} filePath - The file to check
 * @param {string[]} markers - Marker comments that must be present
 */
const assertMarkers = (filePath, markers) => {
  const relativePath = path.relative(process.cwd(), filePath);

  if (!fs.existsSync(filePath)) {
    throw new CliError(`Cannot find ${relativePath}.`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const missing = markers.filter((marker) => !content.includes(marker));

  if (missing.length > 0) {
    throw new CliError(
      `${relativePath} is missing the marker comment "${missing[0]}".\n` +
        `express-mod-cli inserts generated code below that comment - please restore it and try again.`
    );
  }
};

/**
 * Insert content on the line(s) below a marker comment, keeping the marker's indentation
 * @param {string} filePath - The file to update
 * @param {string} marker - The marker comment to insert below
 * @param {string} newContent - The content to insert (may be multi-line)
 */
const insertAfterMarker = (filePath, marker, newContent) => {
  assertMarkers(filePath, [marker]);

  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const markerIndex = lines.findIndex((line) => line.includes(marker));
  const indent = lines[markerIndex].match(/^\s*/)[0];
  const newLines = newContent
    .split("\n")
    .map((line) => (line ? indent + line : line));

  lines.splice(markerIndex + 1, 0, ...newLines);
  fs.writeFileSync(filePath, lines.join("\n"));
};

/**
 * Append content to a file, creating it if needed
 * @param {string} filePath - The file to append to
 * @param {string} content - The content to append
 */
const appendToFile = (filePath, content) => {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf-8")
    : "";
  // Keep one blank line between the existing content and the new block
  const separator =
    existing === "" ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  fs.appendFileSync(filePath, separator + content.trim() + "\n");
};

module.exports = {
  createFile,
  assertMarkers,
  insertAfterMarker,
  appendToFile,
};
