export class SqlQuery {
  readonly #parts: TemplateStringsArray
  readonly #rawValues: readonly unknown[]

  constructor(
    /** The text of the query. */
    readonly text: string,
    /** The values of the query. */
    readonly values: unknown[],
    /** The name of the query. */
    readonly name: string,
    parts: TemplateStringsArray,
    rawValues: readonly unknown[],
  ) {
    this.#parts = parts
    this.#rawValues = rawValues
  }

  /** @internal */
  getParts(): TemplateStringsArray {
    return this.#parts
  }

  /** @internal */
  getRawValues(): readonly unknown[] {
    return this.#rawValues
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
  prepare(name: string): SqlQuery {
    return new SqlQuery(
      this.text,
      this.values,
      name,
      this.#parts,
      this.#rawValues,
    )
  }
}
