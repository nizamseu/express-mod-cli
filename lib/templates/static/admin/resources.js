const usersResource = require('./users.resource');

// Module admin files are imported here by "express-mod-cli add <module>"
// ADMIN_IMPORTS

/**
 * Everything the admin panel shows, in sidebar order.
 * Each module's options live in src/modules/<module>/<module>.admin.js.
 * @param {{ zodHooks: Function, uploadFile: Function, ValidationError: Function }} helpers
 */
function getResources(helpers) {
  return [
    usersResource(helpers),
    // ADMIN_RESOURCES
  ];
}

module.exports = { getResources };
