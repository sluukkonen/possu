import { possu } from './possu'

export interface SqlQuery {
  text: string
  values: unknown[]
  [possu]: true
}

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
