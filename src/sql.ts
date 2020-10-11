import { SqlQuery, possu } from './SqlQuery'
import { Client } from 'pg'
import { isString } from './util'

const { escapeIdentifier } = Client.prototype

class Identifier {
  constructor(public text: string) {}
}

/** The query builder interface of Possu. */
interface Sql {
  (parts: TemplateStringsArray, ...originalValues: readonly unknown[]): SqlQuery

  /**
   * Escape an SQL
   * [identifier](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
   * to be used in a query. It can be used to create queries which are
   * parametrized by table or column names.
   *
   * @example
   * sql`SELECT * FROM ${sql.identifier('pet')}`
   * // => { text: 'SELECT * FROM "pet"', values: [] }
   */
  identifier: (identifier: string) => Identifier

  /**
   * Serialize a value as JSON to be used in a query.
   *
   * @example
   * sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
   * // => { text : 'SELECT * FROM jsonb_array_elements($1)', values: ['[1,2,3]'] }
   */
  json: (value: unknown) => string
}

/**
 * Create an SQL query.
 *
 * This is the only way to create queries in Possu. Other Possu functions check
 * that the query has been created with `sql`.
 *
 * @example
 * const query = sql`SELECT * FROM pet WHERE id = ${1}`
 * // => { text: 'SELECT * FROM pet WHERE id = $1', values: [1] }
 */
export const sql: Sql = function sql(
  parts: TemplateStringsArray,
  ...originalValues: readonly unknown[]
) {
  // The text of the query as a mutable array.
  const text: string[] = []
  // The final parts array. It may be different than the original values array
  // if queries are nested.
  const values: unknown[] = []
  let placeholderIndex = 1
  const getPlaceholder = () => `$${placeholderIndex++}`

  sqlInner(text, values, parts, originalValues, getPlaceholder)

  return new SqlQuery(text.join(''), values, parts, originalValues)
}

/** The recursive inner loop for `sql`. */
function sqlInner(
  text: string[],
  values: unknown[],
  parts: TemplateStringsArray,
  originalValues: readonly unknown[],
  getPlaceholder: () => string
) {
  text.push(parts[0])

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const value = originalValues[i - 1]

    if (value instanceof SqlQuery) {
      const [nestedParts, nestedOriginalValues] = value[possu]()
      sqlInner(text, values, nestedParts, nestedOriginalValues, getPlaceholder)
      // If the query was nested, do not add a placeholder, since we replace it
      // with the nested query's text.
      text.push(part)
    } else if (value instanceof Identifier) {
      text.push(value.text, part)
    } else {
      text.push(getPlaceholder(), part)
      values.push(value)
    }
  }
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
