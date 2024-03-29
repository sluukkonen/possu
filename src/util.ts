export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isFunction(
  value: unknown,
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

export function coerce<T>(value: unknown): T {
  return value as T
}

export function map<T, U>(rowParser: (value: T) => U, rows: readonly T[]): U[] {
  const result = new Array<U>(rows.length)

  for (let i = 0; i < rows.length; i++) {
    result[i] = rowParser(rows[i])
  }

  return result
}

export function mapField<
  K extends string,
  T,
  U,
  A extends readonly Record<K, T>[],
>(name: K, rowParser: (value: T) => U, rows: A): U[] {
  const result = new Array<U>(rows.length)

  for (let i = 0; i < rows.length; i++) {
    result[i] = rowParser(rows[i][name])
  }

  return result
}
