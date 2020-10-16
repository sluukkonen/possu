export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function coerce<T>(value: unknown): T {
  return value as T
}

export function map<T, U>(fn: (value: T) => U, array: readonly T[]): U[] {
  const result = new Array(array.length)

  for (let i = 0; i < array.length; i++) {
    result[i] = fn(array[i])
  }

  return result
}

export function mapField<
  K extends string,
  T,
  U,
  A extends ReadonlyArray<{ [P in K]: T }>
>(name: K, fn: (value: T) => U, array: A): U[] {
  const result = new Array(array.length)

  for (let i = 0; i < array.length; i++) {
    result[i] = fn(array[i][name])
  }

  return result
}
