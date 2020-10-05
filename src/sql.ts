import { possu } from './possu'

const hasOwnProperty = Object.prototype.hasOwnProperty

export interface SqlQuery {
  text: string
  values: unknown[]
  [possu]: true
}

/**
 * Creates an SQL query.
 *
 * This is the only way to create queries in Possu. Other Possu functions check
 * that the query has been created with `sql`.
 *
 * @example
 * const query = sql`SELECT * FROM pet WHERE id = ${1}`
 * // => { text: 'SELECT * FROM pet WHERE id = $1', values: [1] }
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlQuery {
  let text = strings[0]

  for (let i = 1; i < strings.length; i++) {
    const value = values[i - 1]

    if (isSqlQuery(value)) {
      throw new TypeError('Nested queries are not supported at the moment!')
    }

    text += '$' + i + strings[i]
  }

  return {
    text,
    values,
    [possu]: true,
  }
}

export function isSqlQuery(value: unknown): value is SqlQuery {
  return (
    typeof value === 'object' &&
    value != null &&
    hasOwnProperty.call(value, possu)
  )
}
