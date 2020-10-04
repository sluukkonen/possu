import { Pool } from 'pg'
import { NoRowsReturnedError, TooManyRowsReturnedError } from '../src/errors'
import { query, many, one, maybeOne } from '../src/queries'
import { transaction } from '../src/transaction'
import { sql } from '../src/sql'

let pool: Pool

beforeAll(async () => {
  pool = new Pool({
    database: 'possu-test',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  })
  await pool.query('DROP TABLE IF EXISTS pet')
  await pool.query(
    `CREATE TABLE pet (
      id serial PRIMARY KEY,
      name text
    )`
  )
})

afterAll(() => pool.end())

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE pet RESTART IDENTITY')
  await pool.query(
    `INSERT INTO pet (name) VALUES ('Iiris'), ('Jean'), ('Senna')`
  )
})

describe('query()', () => {
  it('executes a query and returns the result object', async () => {
    const result = await query(pool, sql`SELECT * FROM pet`)

    expect(result.rows).toEqual([
      { id: 1, name: 'Iiris' },
      { id: 2, name: 'Jean' },
      { id: 3, name: 'Senna' },
    ])
    expect(result.fields).toHaveLength(2)
  })

  it('throws an error if the query was not construced with the `sql` tagged template string', async () => {
    await expect(query(pool, 'SELECT * FROM user' as any)).rejects.toThrowError(
      new TypeError(
        'The query was not constructed with the `sql` tagged template literal'
      )
    )

    await expect(
      query(pool, { text: 'SELECT * FROM user', values: [] } as any)
    ).rejects.toThrowError(
      new TypeError(
        'The query was not constructed with the `sql` tagged template literal'
      )
    )
  })
})

describe('many()', () => {
  it('executes a query and returns the result rows', () =>
    expect(many(pool, sql`SELECT * FROM pet`)).resolves.toEqual([
      { id: 1, name: 'Iiris' },
      { id: 2, name: 'Jean' },
      { id: 3, name: 'Senna' },
    ]))

  it('unwraps the values if selecting a single column', () =>
    expect(many(pool, sql`SELECT name FROM pet`)).resolves.toEqual([
      'Iiris',
      'Jean',
      'Senna',
    ]))
})

describe('one()', () => {
  it('executes a query and returns the first row', () =>
    expect(
      one(pool, sql`SELECT * FROM pet WHERE name = ${'Iiris'}`)
    ).resolves.toEqual({
      id: 1,
      name: 'Iiris',
    }))

  it('unwraps the value if selecting a single column', () =>
    expect(
      one(pool, sql`SELECT name FROM pet WHERE id = ${1}`)
    ).resolves.toEqual('Iiris'))

  it('throws an error if the result contains too many rows', () =>
    expect(one(pool, sql`SELECT * FROM pet`)).rejects.toThrowError(
      TooManyRowsReturnedError
    ))

  it('throws an error if the result is empty', () =>
    expect(
      one(pool, sql`SELECT * FROM pet WHERE name = ${'Nobody'}`)
    ).rejects.toThrowError(NoRowsReturnedError))
})

describe('maybeOne()', () => {
  it('executes a query and returns the first row, if it exists', () =>
    expect(
      maybeOne(pool, sql`SELECT * FROM pet WHERE name = ${'Iiris'}`)
    ).resolves.toEqual({ id: 1, name: 'Iiris' }))

  it('unwraps the value if selecting a single column', () =>
    expect(
      maybeOne(pool, sql`SELECT name FROM pet WHERE id = ${1}`)
    ).resolves.toEqual('Iiris'))

  it('executes a query and returns undefined if the result is empty', async () => {
    await expect(
      maybeOne(pool, sql`SELECT * FROM pet WHERE name = ${'Nobody'}`)
    ).resolves.toBeUndefined()

    await expect(
      maybeOne(pool, sql`SELECT name FROM pet WHERE name = ${'Nobody'}`)
    ).resolves.toBeUndefined()
  })

  it('throws an error if the result contains too many rows', () => {
    expect(maybeOne(pool, sql`SELECT * FROM pet`)).rejects.toThrowError(
      TooManyRowsReturnedError
    )
  })
})

describe('transaction()', () => {
  it('executes a set of queries in a transaction, commiting the results', async () => {
    await expect(
      transaction(pool, (tx) =>
        one(tx, sql`INSERT INTO pet (name) VALUES ('Bethany') RETURNING id`)
      )
    ).resolves.toEqual(4)

    await expect(many(pool, sql`SELECT name FROM pet`)).resolves.toEqual([
      'Iiris',
      'Jean',
      'Senna',
      'Bethany',
    ])
  })

  it('rolls back the transaction if an exception is thrown', async () => {
    await expect(
      transaction(pool, async (tx) => {
        await one(
          tx,
          sql`INSERT INTO pet (name) VALUES ('Bethany') RETURNING id`
        )
        throw new Error('Boom!')
      })
    ).rejects.toThrowError(new Error('Boom!'))

    await expect(many(pool, sql`SELECT name FROM pet`)).resolves.toEqual([
      'Iiris',
      'Jean',
      'Senna',
    ])
  })

  it('accepts a checked-out client as well', async () => {
    const client = await pool.connect()
    try {
      await expect(
        transaction(client, (tx) => one(tx, sql`SELECT count(*) FROM pet`))
      ).resolves.toEqual('3')
    } finally {
      client.release()
    }
  })
})
