import { SqlQuery, possu } from './SqlQuery'
import { Client } from 'pg'
import { isArray, isObject, isString } from './util'

const { escapeIdentifier } = Client.prototype

class Identifier {
  constructor(public text: string) {}
}

class ValuesList<T extends Record<string, unknown>, K extends keyof T> {
  constructor(public objects: T[], public keys: K[]) {}
}

/** The query builder interface of Possu. */
interface Sql {
  (parts: TemplateStringsArray, ...values: readonly unknown[]): SqlQuery

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

  /**
   * Construct a values list from a non-empty array of objects. Useful as a
   * data source to `INSERT` queries or when writing complex subqueries.
   *
   * @example
   * sql`INSERT INTO pet (name, age) ${sql.values([
   *   { name: 'Iiris', age: 5 },
   *   { name: 'Napoleon', age: 11 },
   * ])}`
   * // => { text: 'INSERT INTO pet (name, age) VALUES ($1, $2), ($3, $4)', values: ['Iiris', 5, 'Napoleon', 11] }
   *
   * You can also customize the set of keys used.
   *
   * @example
   * sql`INSERT INTO pet (name) ${sql.values(
   *   [
   *     { name: 'Iiris', age: 5 },
   *     { name: 'Napoleon', age: 11 },
   *   ],
   *   'name'
   * )}`
   * // => { text: 'INSERT INTO pet (name) VALUES ($1), ($2)', values: ['Iiris', 'Napoleon'] }
   */
  values: <T extends Record<string, unknown>, K extends keyof T>(
    objects: T[],
    ...keys: K[]
  ) => ValuesList<T, K>
}

/**
 * Create an SQL query.
 *
 * This is the only way to create queries in Possu. To prevent accidental SQL
 * injections, other Possu functions check at runtime that the query has been
 * created with `sql`.
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
    } else if (value instanceof ValuesList) {
      appendSqlValuesList(text, values, value, getPlaceholder)
      text.push(part)
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

sql.values = function values(objects, ...keys) {
  if (!isArray(objects) || !objects.every(isObject)) {
    throw new TypeError(
      'The first argument to `sql.values` must be an array of objects'
    )
  } else if (objects.length === 0) {
    throw new Error('The first argument to `sql.values` must be non-empty')
  }

  if (keys.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keys = Object.keys(objects[0]) as any
  }

  if (keys.length === 0) {
    throw new Error('The first object given to `sql.values` must not be empty')
  }

  return new ValuesList(objects, keys)
}

function appendSqlValuesList<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  text: string[],
  values: unknown[],
  valuesList: ValuesList<T, K>,
  getPlaceholder: () => string
): void {
  const { objects, keys } = valuesList
  text.push('VALUES ')

  for (let i = 0; i < objects.length; i++) {
    appendSqlValuesListItem(text, values, objects[i], keys, getPlaceholder)
    if (i < objects.length - 1) text.push(', ')
  }
}

function appendSqlValuesListItem<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  text: string[],
  values: unknown[],
  object: T,
  keys: K[],
  getPlaceholder: () => string
) {
  text.push('(')

  for (let i = 0; i < keys.length; i++) {
    text.push(getPlaceholder())
    if (i < keys.length - 1) text.push(', ')
    values.push(object[keys[i]])
  }

  text.push(')')
}
