import { SqlQuery } from './SqlQuery'
import { Client } from 'pg'
import { isString } from './util'

const { escapeIdentifier } = Client.prototype

class Identifier {
  constructor(public text: string) {}
}

/** The query builder interface of Possu. */
interface Sql {
  (parts: TemplateStringsArray, ...rawValues: readonly unknown[]): SqlQuery

  /**
   * Escape an SQL
   * [identifier](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
   * to be used in a query. It can be used to create queries which are
   * parametrized by table or column names.
   *
   * @example
   * sql`SELECT * FROM ${sql.identifier('users')}`
   * // => SqlQuery { text: 'SELECT * FROM "users"', values: [] }
   */
  identifier: (identifier: string) => Identifier

  /**
   * Serialize a value as JSON to be used in a query.
   *
   * @example
   * sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
   * // => SqlQuery { text : 'SELECT * FROM jsonb_array_elements($1)', values: ['[1,2,3]'] }
   */
  json: (value: unknown) => string
}

/**
 * Create an SQL query.
 *
 * This is the only way to create queries in Possu. To prevent accidental SQL
 * injections, other Possu functions check at runtime that the query has been
 * created with `sql`.
 *
 * @example
 * const query = sql`SELECT * FROM users WHERE id = ${1}`
 * // => SqlQuery { text: 'SELECT * FROM users WHERE id = $1', values: [1] }
 */
export const sql: Sql = function sql(
  parts: TemplateStringsArray,
  ...rawValues: readonly unknown[]
) {
  // The text of the query as a mutable array.
  // The final parts array. It may be different than the original values array
  // if queries are nested.
  const values: unknown[] = []
  let placeholderIndex = 1
  const getPlaceholder = () => `$${placeholderIndex++}`

  const text = sqlInner('', values, parts, rawValues, getPlaceholder)

  return new SqlQuery(text, values, '', parts, rawValues)
}

/** The recursive inner loop for `sql`. */
function sqlInner(
  text: string,
  values: unknown[],
  parts: TemplateStringsArray,
  rawValues: readonly unknown[],
  getPlaceholder: () => string
): string {
  text += parts[0]

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const rawValue = rawValues[i - 1]

    if (rawValue instanceof SqlQuery) {
      text = sqlInner(
        text,
        values,
        rawValue.getParts(),
        rawValue.getRawValues(),
        getPlaceholder
      )
      // If the query was nested, do not add a placeholder, since we replace it
      // with the nested query's text.
      text += part
    } else if (rawValue instanceof Identifier) {
      text += rawValue.text + part
    } else {
      text += getPlaceholder() + part
      values.push(rawValue)
    }
  }

  return text
}

sql.identifier = function identifier(identifier: string) {
  if (!isString(identifier)) {
    throw new TypeError(`Invalid identifier: ${identifier}`)
  }
  return new Identifier(escapeIdentifier(identifier))
}

sql.json = function json(value: unknown) {
  return JSON.stringify(value)
}
