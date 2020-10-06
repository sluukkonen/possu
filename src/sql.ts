import { possu } from './possu'

const hasOwnProperty = Object.prototype.hasOwnProperty

export interface SqlQuery {
  text: string
  values: unknown[]
  [possu]: () => [TemplateStringsArray, unknown[]]
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
  parts: TemplateStringsArray,
  ...originalValues: unknown[]
): SqlQuery {
  // The text of the query as a mutable array.
  const text: string[] = []
  // The final parts array. It may be different than the original values array
  // if queries are nested.
  const values: unknown[] = []
  let placeholderIndex = 1
  const getPlaceholder = () => `$${placeholderIndex++}`

  sqlInner(text, values, parts, originalValues, getPlaceholder)

  return {
    text: text.join(''),
    values,
    [possu]: () => [parts, originalValues],
  }
}

/** The recursive inner loop for `sql`. */
function sqlInner(
  text: string[],
  values: unknown[],
  parts: TemplateStringsArray,
  originalValues: unknown[],
  getPlaceholder: () => string
) {
  text.push(parts[0])

  for (let i = 1; i < parts.length; i++) {
    const value = originalValues[i - 1]

    if (isSqlQuery(value)) {
      const [nestedParts, nestedOriginalValues] = value[possu]()
      sqlInner(text, values, nestedParts, nestedOriginalValues, getPlaceholder)
      // If the query was nested, do not add a placeholder, since we replace it
      // with the nested query's text.
      text.push(parts[i])
    } else {
      text.push(getPlaceholder(), parts[i])
      values.push(value)
    }
  }
}

function isSqlQuery(value: unknown): value is SqlQuery {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasOwnProperty.call(value, possu)
  )
}
