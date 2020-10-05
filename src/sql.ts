import { possu } from './possu'

export interface SqlQuery {
  text: string
  values: unknown[]
  [possu]: true
}

/**
 * Creates an SQL query that the other functions of Possu accept.
 *
 * This is the only way to create queries in Possu. Other possu functions check
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
  return {
    text: strings.reduce((str, acc, i) => str + '$' + i + acc),
    values,
    [possu]: true,
  }
}
