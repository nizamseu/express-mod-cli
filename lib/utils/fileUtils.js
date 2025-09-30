const fs = require("fs");
const path = require("path");

/**
 * Create files and directories recursively
 * @param {string} filePath - The path where the file should be created
 * @param {string} content - The content to write to the file
 */
const createFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content.trim() + "\n");
};

/**
 * Check if a directory exists
 * @param {string} dirPath - The directory path to check
 * @returns {boolean} - Whether the directory exists
 */
const directoryExists = (dirPath) => {
  return fs.existsSync(dirPath);
};

/**
 * Check if we're in an Express project directory
 * @param {string} projectPath - The project path to check
 * @returns {boolean} - Whether it's a valid Express project
 */
const isExpressProject = (projectPath) => {
  return fs.existsSync(path.join(projectPath, "package.json"));
};

/**
 * Update a file by replacing placeholders with new content
 * @param {string} filePath - The file to update
 * @param {string} placeholder - The placeholder to replace
 * @param {string} newContent - The new content to insert
 */
const updateFileContent = (filePath, placeholder, newContent) => {
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(placeholder, `${placeholder}\n${newContent}`);
  fs.writeFileSync(filePath, content);
};

module.exports = {
  createFile,
  directoryExists,
  isExpressProject,
  updateFileContent,
};
