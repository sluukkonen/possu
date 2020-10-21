import { Pool, PoolClient, QueryResult } from 'pg'
import { ResultError } from './errors'
import { SqlQuery } from './SqlQuery'
import { coerce, map, mapField } from './util'

/**
 * Execute a `SELECT` or other query that returns zero or more rows.
 *
 * Returns all rows.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 * @param rowParser A function that validates and transforms each row.
 */
export async function query<T>(
  client: Pool | PoolClient,
  sql: SqlQuery,
  rowParser: (row: unknown) => T = coerce
): Promise<T[]> {
  const { fields, rows } = await send(client, sql)

  if (fields.length !== 1) {
    return rowParser === coerce ? rows : map(rowParser, rows)
  } else {
    return mapField(fields[0].name, rowParser, rows)
  }
}

/**
 * Execute a `SELECT` or other query that returns exactly one row.
 *
 * Returns the first row.
 *
 * - Throws a `ResultError` if query does not return exactly one row.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 * @param rowParser A function that validates and transforms the row.
 */
export async function queryOne<T = unknown>(
  client: Pool | PoolClient,
  sql: SqlQuery,
  rowParser: (row: unknown) => T = coerce
): Promise<T> {
  const { fields, rows } = await send(client, sql)
  const { length } = rows

  if (length === 0 || length > 1) {
    throw new ResultError(
      `Expected query to return exactly 1 row, got ${length}`,
      sql
    )
  }

  return fields.length !== 1
    ? rowParser(rows[0])
    : rowParser(rows[0][fields[0].name])
}

/**
 * Execute a `SELECT` or other query that returns zero or one rows.
 *
 * Returns the first row or `undefined`.
 *
 * - Throws a `ResultError` if query returns more than 1 row.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 * @param rowParser A function that validates and transforms each row.
 */
export async function queryMaybeOne<T = unknown>(
  client: Pool | PoolClient,
  sql: SqlQuery,
  rowParser: (row: unknown) => T = coerce
): Promise<T | undefined> {
  const { fields, rows } = await send(client, sql)
  const { length } = rows

  if (length > 1) {
    throw new ResultError(
      `Expected query to return 1 row at most, got ${length}`,
      sql
    )
  }

  return length === 0
    ? undefined
    : fields.length !== 1
    ? rowParser(rows[0])
    : rowParser(rows[0][fields[0].name])
}

/**
 * Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows.
 *
 * Returns the number of rows affected.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function execute(
  client: Pool | PoolClient,
  sql: SqlQuery
): Promise<number> {
  const { rowCount } = await send(client, sql)
  return rowCount
}

function send(client: Pool | PoolClient, sql: SqlQuery): Promise<QueryResult> {
  if (!(sql instanceof SqlQuery)) {
    throw new TypeError(
      'The query was not constructed with the `sql` tagged template literal'
    )
  }

  return client.query(sql)
}
