import { possu } from './possu'

export interface SqlQuery {
  text: string
  values: any[]
  [possu]: true
}

export function sql(strings: TemplateStringsArray, ...values: any[]): SqlQuery {
  return {
    text: strings.reduce((str, acc, i) => str + '$' + i + acc),
    values,
    [possu]: true,
  }
}
