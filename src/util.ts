export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function escapeIdentifier(str: string): string {
  // Ported from https://github.com/brianc/node-postgres/blob/0758b766aa04fecef24f0fd2f94bfcbea0481176/packages/pg/lib/client.js#L435-L437
  return '"' + str.replace(/"/g, '""') + '"'
}
