const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('./uploads');

/**
 * Export and Import buttons on every page of the panel.
 * - Export: CSV or JSON of the records (with the list's filters), without hidden fields
 * - Import: CSV or JSON; every row goes through the same checks as the "Create new"
 *   form (the module's Zod schema, password hashing for users). Rows that fail are
 *   skipped and listed. Each imported record gets its own line in the admin log.
 *   A file or image column holds the path of a file that is already in uploads/
 *   (what Export writes); a CSV file can't carry the files themselves.
 */

const MAX_EXPORT = 100000;
const MAX_IMPORT = 10000;
// Set by the database, never imported
const SYSTEM_FIELDS = ['_id', 'id', '__v', 'createdAt', 'updatedAt'];

/** Is this a path of an existing file inside uploads/? */
async function isUploadedFile(value) {
  if (typeof value !== 'string' || value === '') return true;
  const file = path.resolve(UPLOADS_DIR, value);
  if (!file.startsWith(UPLOADS_DIR + path.sep)) return false;
  return fs.promises.stat(file).then((stat) => stat.isFile(), () => false);
}

/** One CSV cell: quoted when it contains a comma, quote or line break */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }
  return lines.join('\r\n');
}

/** Parse CSV text (first line: column names) into objects */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [header = [], ...data] = rows.filter((line) => line.some((value) => value !== ''));
  const columns = header.map((name) => name.replace(/^﻿/, '').trim());
  return data.map((line) => Object.fromEntries(columns.map((column, index) => [column, line[index] ?? ''])));
}

/** What a failed row says, e.g. "price: Expected number" */
function describeError(error) {
  const fields = Object.entries(error.propertyErrors || {}).map(([field, { message }]) => `${field}: ${message}`);
  if (error.baseError?.message) fields.push(error.baseError.message);
  return fields.length > 0 ? fields.join('; ') : error.message;
}

/**
 * @param {object} adminjs - Filter, ValidationError and flat from adminjs, the components,
 *   and the admin log's save / entryFor
 */
function createImportExport({ Filter, ValidationError, flat, components, save, entryFor }) {
  /** Columns: the record id and the fields the "Show" page displays */
  function exportColumns(resource) {
    const stored = new Set(resource.properties().map((property) => property.path()));
    const id = resource.properties().find((property) => property.isId())?.path();
    const shown = resource
      .decorate()
      .getProperties({ where: 'show' })
      .map((property) => property.propertyPath)
      .filter((name) => stored.has(name) && name !== id);
    return [...(id ? [id] : []), ...shown];
  }

  async function exportHandler(request, response, context) {
    if (request.method !== 'post') return {};

    const { resource } = context;
    const type = request.query?.type === 'json' ? 'json' : 'csv';
    const { filters = {} } = flat.unflatten(request.query || {});
    const filter = await new Filter(filters, resource).populate(context);
    const columns = exportColumns(resource);
    const records = await resource.find(
      filter,
      { limit: MAX_EXPORT, sort: { sortBy: columns[0], direction: 'asc' } },
      context
    );

    const rows = records.map((record) => Object.fromEntries(columns.map((column) => [column, record.params[column]])));
    const date = new Date().toISOString().slice(0, 10);

    return {
      exportedData: type === 'json' ? JSON.stringify(rows, null, 2) : toCsv(rows, columns),
      fileName: `${resource.id()}-${date}.${type}`,
      mimeType: type === 'json' ? 'application/json' : 'text/csv',
    };
  }

  async function importHandler(request, response, context) {
    if (request.method !== 'post') return {};

    const file = request.payload?.file;
    if (!file?.path) {
      throw new ValidationError({ file: { message: 'Choose a CSV or JSON file' } });
    }

    const text = await fs.promises.readFile(file.path, 'utf-8');
    let rows;
    try {
      rows = /\.json$/i.test(file.name || '') ? JSON.parse(text) : parseCsv(text);
    } catch (error) {
      throw new ValidationError({ file: { message: `The file could not be read: ${error.message}` } });
    }
    if (!Array.isArray(rows)) {
      throw new ValidationError({ file: { message: 'A JSON file must contain a list of records' } });
    }
    if (rows.length > MAX_IMPORT) {
      throw new ValidationError({ file: { message: `At most ${MAX_IMPORT} rows at a time` } });
    }

    // Each row is checked like a "Create new" form
    const { resource } = context;
    const hooks = [].concat(resource.decorate().options.actions?.new?.before || []);
    const createContext = { ...context, action: { ...context.action, name: 'new' }, record: undefined };
    const failed = [];
    const logEntries = [];
    let created = 0;

    // Columns that hold an uploaded file's path, and the record's id and title
    const decorated = resource.decorate();
    const fileColumns = decorated
      .getProperties({ where: 'edit' })
      .map((property) => property.options?.custom?.keyProperty)
      .filter(Boolean);
    const idPath = resource.properties().find((property) => property.isId())?.path() || 'id';
    const titlePath = decorated.titleProperty()?.name();

    for (const [index, row] of rows.entries()) {
      try {
        const payload = Object.fromEntries(
          Object.entries(row).filter(([key, value]) => !SYSTEM_FIELDS.includes(key) && value !== undefined)
        );
        for (const column of fileColumns) {
          if (!(await isUploadedFile(payload[column]))) {
            throw new ValidationError({ [column]: { message: 'There is no such file in uploads/' } });
          }
        }

        let createRequest = { method: 'post', payload, query: {}, params: {} };
        for (const hook of hooks) {
          createRequest = await hook(createRequest, createContext);
        }
        const params = await resource.create(createRequest.payload, createContext);
        created += 1;
        logEntries.push(entryFor(context, 'add', { id: params[idPath], title: titlePath ? params[titlePath] : undefined }));
      } catch (error) {
        // Line in the file: CSV has a header line
        failed.push({ row: /\.json$/i.test(file.name || '') ? index + 1 : index + 2, message: describeError(error) });
      }
    }

    if (created > 0) {
      logEntries.push({ ...entryFor(context, 'import'), recordTitle: `${created} of ${rows.length} rows from ${file.name}` });
      // Written in batches, so a large import doesn't open hundreds of database requests at once
      for (let start = 0; start < logEntries.length; start += 100) {
        await save(logEntries.slice(start, start + 100));
      }
    }

    return {
      results: { total: rows.length, created, failed: failed.slice(0, 100), failedCount: failed.length },
      notice: {
        message: `Imported ${created} of ${rows.length} rows`,
        type: failed.length > 0 ? 'error' : 'success',
      },
    };
  }

  /** Add the Export and Import buttons to a resource */
  return function withImportExport(resource) {
    return {
      ...resource,
      options: {
        ...resource.options,
        actions: {
          ...resource.options?.actions,
          export: { actionType: 'resource', icon: 'Download', component: components.Export, handler: exportHandler },
          import: { actionType: 'resource', icon: 'Upload', component: components.Import, handler: importHandler },
        },
      },
    };
  };
}

module.exports = { createImportExport, toCsv, parseCsv };
