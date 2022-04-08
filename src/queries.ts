import * as pg from 'pg'
import { ResultError } from './errors'
import { SqlQuery } from './SqlQuery'
import { coerce, map, mapField } from './util'
import { Transaction } from './transaction'

/** A connection pool or a connection checked out of a pool. */
export type Connection = pg.Pool | pg.PoolClient

/**
 * Execute a `SELECT` or other query that returns zero or more rows. Returns all rows.
 *
 * @param connection A connection pool or a connection checked out from a pool.
 * @param sql The SQL query to execute.
 * @param rowParser A function that validates and transforms each row.
 */
export async function query<T>(
  connection: Connection,
  sql: SqlQuery,
  rowParser: (row: unknown) => T = coerce
): Promise<T[]> {
  const { fields, rows } = await send(connection, sql)

  if (fields.length !== 1) {
    return rowParser === coerce ? rows : map(rowParser, rows)
  } else {
    return mapField(fields[0].name, rowParser, rows)
  }
}

/**
 * Execute a `SELECT` or other query that returns exactly one row. Returns the first row.
 *
 * - Throws a `ResultError` if query does not return exactly one row.
 *
 * @param connection A connection pool or a connection checked out from a pool.
 * @param sql The SQL query to execute.
 * @param rowParser A function that validates and transforms the row.
 */
export async function queryOne<T = unknown>(
  connection: Connection,
  sql: SqlQuery,
  rowParser: (row: unknown) => T = coerce
): Promise<T> {
  const { fields, rows } = await send(connection, sql)
  const { length } = rows

  if (length !== 1) {
    throw new ResultError(
      `Expected query to return exactly 1 row, got ${length} rows`,
      sql
    )
  }

  return fields.length !== 1
    ? rowParser(rows[0])
    : rowParser(rows[0][fields[0].name])
}

/**
 * Execute a `SELECT` or other query that returns zero or one rows. Returns the first row or `undefined`.
 *
 * - Throws a `ResultError` if query returns more than 1 row.
 *
 * @param connection A connection pool or a connection checked out from a pool.
 * @param sql The SQL query to execute.
 * @param rowParser A function that validates and transforms each row.
 */
export async function queryMaybeOne<T = unknown>(
  connection: Connection,
  sql: SqlQuery,
  rowParser: (row: unknown) => T = coerce
): Promise<T | undefined> {
  const { fields, rows } = await send(connection, sql)
  const { length } = rows

  if (length > 1) {
    throw new ResultError(
      `Expected query to return 0–1 rows, got ${length} rows`,
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
 * Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows. Returns the number
 * of rows affected.
 *
 * @param connection A connection pool or a connection checked out from a pool.
 * @param sql The SQL query to execute.
 */
export async function execute(
  connection: Connection,
  sql: SqlQuery
): Promise<number> {
  const { rowCount } = await send(connection, sql)
  return rowCount
}

/**
 * Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows. Returns the number
 * of rows affected.
 *
 * - Throws a {@link ResultError} if the query doesn't affect exactly one row.
 * - Unlike {@link execute}, it must be called within an explicit transaction, so the changes can be rolled back.
 *
 * @param tx A connection belonging to an active transaction.
 * @param sql The SQL query to execute.
 */
export async function executeOne(
  tx: Transaction,
  sql: SqlQuery
): Promise<number> {
  const { rowCount } = await send(tx, sql)

  if (rowCount !== 1)
    throw new ResultError(
      `Expected query to modify exactly 1 row, but it modified ${rowCount} rows`,
      sql
    )

  return rowCount
}

/**
 * Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows. Returns the number
 * of rows affected.
 *
 * - Throws a {@link ResultError} if the query affects more than one row.
 * - Unlike {@link execute}, it must be called within an explicit transaction, so the changes can be rolled back.
 *
 * @param tx A connection belonging to an active transaction.
 * @param sql The SQL query to execute.
 */
export async function executeMaybeOne(
  tx: Transaction,
  sql: SqlQuery
): Promise<number> {
  const { rowCount } = await send(tx, sql)

  if (rowCount > 1)
    throw new ResultError(
      `Expected query to modify 0–1 rows, but it modified ${rowCount} rows`,
      sql
    )

  return rowCount
}

function send(connection: Connection, sql: SqlQuery): Promise<pg.QueryResult> {
  if (!(sql instanceof SqlQuery)) {
    throw new TypeError(
      'The query was not constructed with the `sql` tagged template literal'
    )
  }

  return connection.query(sql)
}
