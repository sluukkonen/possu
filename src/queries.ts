import { Pool, PoolClient, QueryResult } from 'pg'
import { NoRowsReturnedError, TooManyRowsReturnedError } from './errors'
import { possu } from './possu'
import { SqlQuery } from './sql'

export type Client = PoolClient | Pool

/**
 * Execute a `SELECT` or other query that returns zero or more result rows.
 *
 * Returns all result rows.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function query<T>(client: Client, sql: SqlQuery): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fields, rows } = await send<any>(client, sql)

  if (fields.length !== 1) {
    return rows
  } else {
    const { name } = fields[0]
    return rows.map((row) => row[name])
  }
}

/**
 * Execute a `SELECT` or other query that returns exactly one row.
 *
 * Returns the first row.
 *
 * - Throws a `NoRowsReturnedError` if query returns no rows.
 * - Throws a `TooManyRowsReturnedError` if query returns more than 1 row.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function queryOne<T>(client: Client, sql: SqlQuery): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fields, rows } = await send<any>(client, sql)
  const { length } = rows

  if (length === 0) {
    throw new NoRowsReturnedError(`Expected query to return exactly 1 row`, sql)
  } else if (length > 1) {
    throw new TooManyRowsReturnedError(
      `Expected query to return exactly 1 row, got ${length}`,
      sql
    )
  }

  return fields.length !== 1 ? rows[0] : rows[0][fields[0].name]
}

/**
 * Execute a `SELECT` or other query that returns zero or one result rows.
 *
 * Returns the first row or `undefined`.
 *
 * - Throws a `TooManyRowsReturnedError` if query returns more than 1 row.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function queryMaybeOne<T>(
  client: Client,
  sql: SqlQuery
): Promise<T | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fields, rows } = await send<any>(client, sql)
  const { length } = rows

  if (length > 1) {
    throw new TooManyRowsReturnedError(
      `Expected query to return at most 1 row, got ${length}`,
      sql
    )
  }

  return fields.length !== 1
    ? rows[0]
    : length === 0
    ? undefined
    : rows[0][fields[0].name]
}

/**
 * Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows.
 *
 * Returns the number of rows affected.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function execute(client: Client, sql: SqlQuery): Promise<number> {
  const { rowCount } = await send(client, sql)
  return rowCount
}

async function send<T>(client: Client, sql: SqlQuery): Promise<QueryResult<T>> {
  if (!sql || !sql[possu]) {
    throw new TypeError(
      'The query was not constructed with the `sql` tagged template literal'
    )
  }

  return client.query(sql)
}
