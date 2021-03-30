export const partsSymbol = Symbol('parts')
export const rawValuesSymbol = Symbol('rawValues')

export class SqlQuery {
  /** The text of the query. */
  text: string
  /** The values of the query. */
  values: unknown[];
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
}
