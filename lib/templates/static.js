const fs = require("fs");
const path = require("path");

/**
 * Files that are copied into generated projects unchanged live in ./static,
 * one .js and one .ts version each, so they can be read and linted as code.
 * @param {string} name - File name without extension (e.g. "listQuery")
 * @param {"js"|"ts"} language - Project language
 * @returns {string} - File content
 */
const readStatic = (name, language) =>
  fs.readFileSync(path.join(__dirname, "static", `${name}.${language}`), "utf-8");

module.exports = { readStatic };
