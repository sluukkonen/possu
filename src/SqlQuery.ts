export const possu = Symbol('possu')

export class SqlQuery {
  /** The text of the query. */
  text: string
  /** The values of the query. */
  values: unknown[];
  /** @internal */
  [possu]: () => readonly [TemplateStringsArray, readonly unknown[]]

  constructor(
    text: string,
    values: unknown[],
    parts: TemplateStringsArray,
    originalValues: readonly unknown[]
  ) {
    this.text = text
    this.values = values
    this[possu] = () => [parts, originalValues]
  }
}
