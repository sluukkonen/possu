import { Pool, PoolClient, QueryResult } from 'pg'
import { NoRowsReturnedError, TooManyRowsReturnedError } from './errors'
import { possu } from './possu'
import { SqlQuery } from './sql'

export type Client = PoolClient | Pool

export async function one<T>(client: Client, sql: SqlQuery): Promise<T> {
  const { fields, rows } = await query<any>(client, sql)
  const { length } = rows

  if (length === 0) {
    throw new NoRowsReturnedError(`Expected query to return exactly 1 row`, sql)
  } else if (length > 1) {
    throw new TooManyRowsReturnedError(
      `Expected query to return exactly 1 row, got ${length} rows`,
      sql
    )
  }

  return fields.length !== 1 ? rows[0] : rows[0][fields[0].name]
}

export async function maybeOne<T>(
  client: Client,
  sql: SqlQuery
): Promise<T | undefined> {
  const { fields, rows } = await query<any>(client, sql)
  const { length } = rows

  if (length > 1) {
    throw new TooManyRowsReturnedError(
      `Expected query to return at most 1 row, got ${length} rows`,
      sql
    )
  }

  return fields.length !== 1
    ? rows[0]
    : length === 0
    ? undefined
    : rows[0][fields[0].name]
}

export async function many<T>(client: Client, sql: SqlQuery): Promise<T[]> {
  const { fields, rows } = await query<any>(client, sql)

  if (fields.length !== 1) {
    return rows
  } else {
    const { name } = fields[0]
    return rows.map((row: any) => row[name])
  }
}

export async function query<T>(
  client: Client,
  sql: SqlQuery
): Promise<QueryResult<T>> {
  if (!sql || !sql[possu]) {
    throw new TypeError(
      'The query was not constructed with the `sql` tagged template literal'
    )
  }

  return client.query(sql)
}
