const express = require('express');

/**
 * The admin panel's router.
 *
 * src/app mounts it at the admin path, before helmet and the body parsers (the panel
 * reads its own form data). mountAdmin() in src/admin fills it after the databases
 * are connected. Until then - and in tests, which import the app without starting
 * the server - it is empty, so requests fall through to the 404 handler.
 */
const adminRouter = express.Router();

module.exports = adminRouter;
