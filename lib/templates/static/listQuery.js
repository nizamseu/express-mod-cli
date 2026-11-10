const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** An error the error handler answers with "400 Bad Request" */
const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

/** "3" -> 3, missing -> fallback, anything else -> 400 */
function toPositiveInt(value, fallback, name) {
  if (value === undefined || value === '') return fallback;

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw badRequest(`"${name}" must be a positive whole number`);
  }
  return number;
}

/**
 * Read paging, sorting and search options from a query string:
 *
 *   ?page=2&limit=10&sort=-createdAt,name&search=phone
 *
 * @param {object} query - req.query
 * @param {object} options
 * @param {string[]} options.sortable - Fields the client may sort by
 * @param {string} [options.defaultSort] - Used when ?sort is missing ("-" prefix = descending)
 * @param {string} [options.tieBreaker] - Unique field appended to the sort ("id" / "_id"), so records
 *   with equal values keep a fixed order and pages never repeat or skip a record
 * @returns {{ page: number, limit: number, offset: number, sort: [string, 'asc'|'desc'][], search: string }}
 *   `sort` is a list of [field, direction] pairs, accepted by both Mongoose .sort() and Sequelize `order`
 */
function parseListQuery(query, { sortable, defaultSort = '-createdAt', tieBreaker }) {
  const page = toPositiveInt(query.page, 1, 'page');
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT);

  const sortParam = typeof query.sort === 'string' && query.sort.trim() ? query.sort : defaultSort;
  const sort = sortParam.split(',').map((part) => {
    const value = part.trim();
    const field = value.replace(/^-/, '');

    if (!sortable.includes(field)) {
      throw badRequest(`Cannot sort by "${field}". Sortable fields: ${sortable.join(', ')}`);
    }
    return [field, value.startsWith('-') ? 'desc' : 'asc'];
  });

  if (tieBreaker && !sort.some(([field]) => field === tieBreaker)) {
    sort.push([tieBreaker, 'asc']);
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';

  return { page, limit, offset: (page - 1) * limit, sort, search };
}

/** The "pagination" part of a list response */
function paginate(total, page, limit) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Make user input safe inside a regular expression (MongoDB $regex) */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Make user input safe inside a SQL LIKE pattern */
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

module.exports = { parseListQuery, paginate, escapeRegex, escapeLike };
