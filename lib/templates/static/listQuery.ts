const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export type SortOrder = 'asc' | 'desc';

export interface ListQuery {
  page: number;
  limit: number;
  /** Number of records to skip */
  offset: number;
  /** [field, direction] pairs, accepted by both Mongoose .sort() and Sequelize `order` */
  sort: [string, SortOrder][];
  search: string;
}

export interface ListQueryOptions {
  /** Fields the client may sort by */
  sortable: string[];
  /** Used when ?sort is missing ("-" prefix = descending) */
  defaultSort?: string;
  /**
   * Unique field appended to the sort ("id" / "_id"), so records with equal
   * values keep a fixed order and pages never repeat or skip a record
   */
  tieBreaker?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** An error the error handler answers with "400 Bad Request" */
const badRequest = (message: string): Error =>
  Object.assign(new Error(message), { statusCode: 400 });

/** "3" -> 3, missing -> fallback, anything else -> 400 */
function toPositiveInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw badRequest(`"${name}" must be a positive whole number`);
  }
  return number;
}

/**
 * Read paging, sorting and search options from a query string (req.query):
 *
 *   ?page=2&limit=10&sort=-createdAt,name&search=phone
 */
export function parseListQuery(
  query: Record<string, unknown>,
  { sortable, defaultSort = '-createdAt', tieBreaker }: ListQueryOptions
): ListQuery {
  const page = toPositiveInt(query.page, 1, 'page');
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT, 'limit'), MAX_LIMIT);

  const sortParam = typeof query.sort === 'string' && query.sort.trim() ? query.sort : defaultSort;
  const sort = sortParam.split(',').map((part): [string, SortOrder] => {
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
export function paginate(total: number, page: number, limit: number): Pagination {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Make user input safe inside a regular expression (MongoDB $regex) */
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Make user input safe inside a SQL LIKE pattern */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');
