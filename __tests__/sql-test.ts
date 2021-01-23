import { sql } from '../src/sql'

describe('sql()', () => {
  it('empty query', () => {
    expect(sql``).toMatchObject({
      text: '',
      values: [],
    })
  })

  it('supports simple queries', () => {
    expect(sql`SELECT * FROM pet`).toMatchObject({
      text: 'SELECT * FROM pet',
      values: [],
    })
  })

  it('inserts parameters automatically', () => {
    const id = 1
    const name = 'Iiris'

    expect(sql`SELECT * FROM pet WHERE id = ${id}`).toMatchObject({
      text: 'SELECT * FROM pet WHERE id = $1',
      values: [1],
    })

    expect(
      sql`SELECT * FROM pet WHERE id = ${id} OR name = ${name}`
    ).toMatchObject({
      text: 'SELECT * FROM pet WHERE id = $1 OR name = $2',
      values: [1, 'Iiris'],
    })
  })

  it('supports simple nested queries', () => {
    expect(sql`SELECT exists(${sql`SELECT * FROM pet`})`).toMatchObject({
      text: 'SELECT exists(SELECT * FROM pet)',
      values: [],
    })
  })

  it('supports parametrized nested queries', () => {
    expect(
      sql`SELECT ${1}, exists(${sql`SELECT * FROM pet WHERE id = ${2}`}) OR ${3} = ${4}`
    ).toMatchObject({
      text: 'SELECT $1, exists(SELECT * FROM pet WHERE id = $2) OR $3 = $4',
      values: [1, 2, 3, 4],
    })
  })

  it('supports nested queries on multiple levels', () => {
    const alwaysFalse = sql`${true} = ${false}`
    const pets = sql`SELECT * FROM pet WHERE ${alwaysFalse}`
    const exists = sql`SELECT exists(${pets})`

    expect(alwaysFalse).toMatchObject({
      text: '$1 = $2',
      values: [true, false],
    })

    expect(pets).toMatchObject({
      text: 'SELECT * FROM pet WHERE $1 = $2',
      values: [true, false],
    })

    expect(exists).toMatchObject({
      text: 'SELECT exists(SELECT * FROM pet WHERE $1 = $2)',
      values: [true, false],
    })
  })
})

describe('sql.identifier()', () => {
  it('escapes an identifier to be used in a query', () => {
    expect(
      sql`SELECT * FROM ${sql.identifier('pet')} WHERE id = ${1}`
    ).toMatchObject({
      text: 'SELECT * FROM "pet" WHERE id = $1',
      values: [1],
    })
  })

  it('validates that the identifier is a string', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => sql.identifier(null as any)).toThrowError(
      new TypeError('Invalid identifier: null')
    )
  })
})

describe('sql.json()', () => {
  it('serializes a value with JSON.stringify', () => {
    expect(
      sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
    ).toMatchObject({
      text: 'SELECT * FROM jsonb_array_elements($1)',
      values: ['[1,2,3]'],
    })
  })
})

describe('sql.values()', () => {
  it('constructs an SQL values list', () => {
    expect(
      sql`SELECT a, b FROM (${sql.values([{ a: 1, b: 2 }])})`
    ).toMatchObject({
      text: 'SELECT a, b FROM (VALUES ($1, $2))',
      values: [1, 2],
    })
  })

  it('supports constructing a values list with multiple items', () => {
    expect(
      sql`SELECT a, b FROM (${sql.values([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ])})`
    ).toMatchObject({
      text: 'SELECT a, b FROM (VALUES ($1, $2), ($3, $4))',
      values: [1, 2, 3, 4],
    })
  })

  it('supports customizing the keys used', () => {
    expect(
      sql`SELECT a FROM (${sql.values([{ a: 1, b: 2 }], 'a')})`
    ).toMatchObject({
      text: 'SELECT a FROM (VALUES ($1))',
      values: [1],
    })
  })

  it('throws an error if the array is empty', () => {
    expect(() => sql.values([])).toThrowError(
      new Error('The objects array must be non-empty')
    )
  })

  it('throws an error if the first object is empty', () => {
    expect(() => sql.values([{}])).toThrowError(
      new Error('The first object given to `sql.values` must not be empty')
    )
  })

  it('throws an error if objects is not an array of objects', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => sql.values(null as any)).toThrowError(
      new TypeError(
        'The first argument to `sql.values` must be an array of objects'
      )
    )
  })
})
