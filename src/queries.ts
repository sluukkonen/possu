import { Pool, PoolClient, QueryResult } from 'pg'
import { ResultError } from './errors'
import { SqlQuery } from './SqlQuery'

/**
 * Execute a `SELECT` or other query that returns zero or more rows.
 *
 * Returns all rows.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function query<T>(
  client: Pool | PoolClient,
  sql: SqlQuery
): Promise<T[]> {
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
 * - Throws a `ResultError` if query does not return exactly one row.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function queryOne<T>(
  client: Pool | PoolClient,
  sql: SqlQuery
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fields, rows } = await send<any>(client, sql)
  const { length } = rows

  if (length === 0 || length > 1) {
    throw new ResultError(
      `Expected query to return exactly 1 row, got ${length}`,
      sql
    )
  }

  return fields.length !== 1 ? rows[0] : rows[0][fields[0].name]
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
 */
export async function queryMaybeOne<T>(
  client: Pool | PoolClient,
  sql: SqlQuery
): Promise<T | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fields, rows } = await send<any>(client, sql)
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
    ? rows[0]
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
export async function execute(
  client: Pool | PoolClient,
  sql: SqlQuery
): Promise<number> {
  const { rowCount } = await send(client, sql)
  return rowCount
}

async function send<T>(
  client: Pool | PoolClient,
  sql: SqlQuery
): Promise<QueryResult<T>> {
  if (!(sql instanceof SqlQuery)) {
    throw new TypeError(
      'The query was not constructed with the `sql` tagged template literal'
    )
  }

  return client.query(sql)
}
