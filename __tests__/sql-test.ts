import { possu } from '../src/possu'
import { sql } from '../src/sql'

describe('sql()', () => {
  it('empty query', () => {
    expect(sql``).toEqual({
      text: '',
      values: [],
      [possu]: true,
    })
  })

  it('supports simple queries', () => {
    expect(sql`SELECT * FROM pet`).toEqual({
      text: 'SELECT * FROM pet',
      values: [],
      [possu]: true,
    })
  })

  it('inserts parameters automatically', () => {
    const id = 1
    const name = 'Iiris'

    expect(sql`SELECT * FROM pet WHERE id = ${id}`).toEqual({
      text: 'SELECT * FROM pet WHERE id = $1',
      values: [1],
      [possu]: true,
    })

    expect(sql`SELECT * FROM pet WHERE id = ${id} OR name = ${name}`).toEqual({
      text: 'SELECT * FROM pet WHERE id = $1 OR name = $2',
      values: [1, 'Iiris'],
      [possu]: true,
    })
  })

  it('throws an error on nested queries', () => {
    expect(() => sql`SELECT * FROM ${sql`pet`}`).toThrowError(
      new TypeError('Nested queries are not supported at the moment!')
    )
  })
})
