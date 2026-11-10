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
 * Insert content below the first line that matches a pattern, keeping its indentation
 * @param {string} filePath - The file to update
 * @param {RegExp} pattern - Matches the line to insert below
 * @param {string} newContent - The content to insert
 * @returns {boolean} - false when no line matches (nothing is written)
 */
const insertAfterLine = (filePath, pattern, newContent) => {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const index = lines.findIndex((line) => pattern.test(line));
  if (index === -1) return false;

  const indent = lines[index].match(/^\s*/)[0];
  lines.splice(index + 1, 0, ...newContent.split("\n").map((line) => indent + line));
  fs.writeFileSync(filePath, lines.join("\n"));
  return true;
};

/**
 * Replace the settings of an env block in a .env file: lines that set one of the
 * block's variables (and an "optional" comment right above them) are removed,
 * then the block is appended. Keeps each variable defined once.
 * @param {string} filePath - The .env file
 * @param {string} block - KEY=value lines and comments
 */
const setEnvBlock = (filePath, block) => {
  const keys = [...block.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);

  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const kept = lines.filter((line, index) => {
      const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
      if (key && keys.includes(key)) return false;
      // A comment that only described a removed line
      const next = lines[index + 1]?.match(/^([A-Z0-9_]+)=/)?.[1];
      return !(line.startsWith("#") && next && keys.includes(next) && /optional/i.test(line));
    });
    fs.writeFileSync(filePath, kept.join("\n").replace(/\n{3,}/g, "\n\n"));
  }

  appendToFile(filePath, block);
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
  insertAfterLine,
  setEnvBlock,
  appendToFile,
};
