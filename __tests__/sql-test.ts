import { possu } from '../src/possu'
import { sql } from '../src/sql'

describe('sql()', () => {
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
    expect(sql`SELECT * FROM pet WHERE id = ${id} OR name = ${name}`).toEqual({
      text: 'SELECT * FROM pet WHERE id = $1 OR name = $2',
      values: [1, 'Iiris'],
      [possu]: true,
    })
  })
})
