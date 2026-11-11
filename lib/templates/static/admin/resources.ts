import type { ResourceWithOptions } from 'adminjs' with { 'resolution-mode': 'import' };
import usersResource from './users.resource';
import type { AdminHelpers } from './zodHooks';

// Module admin files are imported here by "express-mod-cli add <module>"
// ADMIN_IMPORTS

/**
 * Everything the admin panel shows, in sidebar order.
 * Each module's options live in src/modules/<module>/<module>.admin.ts.
 */
export function getResources(helpers: AdminHelpers): ResourceWithOptions[] {
  return [
    usersResource(helpers),
    // ADMIN_RESOURCES
  ];
}
