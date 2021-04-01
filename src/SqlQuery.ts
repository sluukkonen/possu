export const partsSymbol = Symbol('parts')
export const rawValuesSymbol = Symbol('rawValues')

export class SqlQuery {
  /** The text of the query. */
  text: string
  /** The values of the query. */
  values: unknown[]
  /** The name of the query. */
  name?: string;
  /** @internal */
  [partsSymbol]: TemplateStringsArray;
  /** @internal */
  [rawValuesSymbol]: readonly unknown[]

  constructor(
    text: string,
    values: unknown[],
    parts: TemplateStringsArray,
    rawValues: readonly unknown[]
  ) {
    this.text = text
    this.values = values
    Object.defineProperty(this, partsSymbol, { value: parts })
    Object.defineProperty(this, rawValuesSymbol, { value: rawValues })
  }

  /**
   * Execute the query as a prepared statement.
   *
   * This can sometimes have measurable performance benefits, especially if the query is very complex to parse and plan.
   *
   * See the [PostgreSQL manual](https://www.postgresql.org/docs/current/sql-prepare.html)
   * for more information.
   *
   * @example
   *
   * ```typescript
   * sql`SELECT * FROM users`.prepare('fetch-users')
   * // => SqlQuery { text: 'SELECT * FROM users', values: [], name: 'fetch-users' }
   * ```
   *
   */
  prepare(name: string): this {
    this.name = name
    return this
  }
}
