import { Pool } from 'pg'
import { NoRowsReturnedError, TooManyRowsReturnedError } from '../src/errors'
import { query, queryOne, queryMaybeOne, execute, Client } from '../src/queries'
import { transaction } from '../src/transaction'
import { sql, SqlQuery } from '../src/sql'

let pool: Pool

beforeAll(async () => {
  pool = new Pool({
    database: 'possu-test',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
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

describe('validation', () => {
  it('checks that queries have been constructed with the `sql` tagged template string', async () => {
    const fns: Array<(client: Client, query: SqlQuery) => Promise<unknown>> = [
      query,
      queryOne,
      queryMaybeOne,
      execute,
    ]
    const parameters = [
      'SELECT * FROM pet',
      { text: 'SELECT * FROM pet', values: [] },
    ]

    for (const fn of fns) {
      for (const params of parameters) {
        await expect(fn(pool, params as any)).rejects.toThrow(
          new TypeError(
            'The query was not constructed with the `sql` tagged template literal'
          )
        )
      }
    }
  })
})

describe('query()', () => {
  it('executes a query and returns the result rows', () =>
    expect(query(pool, sql`SELECT * FROM pet`)).resolves.toEqual([
      { id: 1, name: 'Iiris' },
      { id: 2, name: 'Jean' },
      { id: 3, name: 'Senna' },
    ]))

  it('unwraps the values if selecting a single column', () =>
    expect(query(pool, sql`SELECT name FROM pet`)).resolves.toEqual([
      'Iiris',
      'Jean',
      'Senna',
    ]))
})

describe('queryOne()', () => {
  it('executes a query and returns the first row', () =>
    expect(
      queryOne(pool, sql`SELECT * FROM pet WHERE name = ${'Iiris'}`)
    ).resolves.toEqual({
      id: 1,
      name: 'Iiris',
    }))

  it('unwraps the value if selecting a single column', () =>
    expect(
      queryOne(pool, sql`SELECT name FROM pet WHERE id = ${1}`)
    ).resolves.toEqual('Iiris'))

  it('throws an error if the result contains too many rows', () =>
    expect(queryOne(pool, sql`SELECT * FROM pet`)).rejects.toThrowError(
      TooManyRowsReturnedError
    ))

  it('throws an error if the result is empty', () =>
    expect(
      queryOne(pool, sql`SELECT * FROM pet WHERE name = ${'Nobody'}`)
    ).rejects.toThrowError(NoRowsReturnedError))
})

describe('maybeOne()', () => {
  it('executes a query and returns the first row, if it exists', () =>
    expect(
      queryMaybeOne(pool, sql`SELECT * FROM pet WHERE name = ${'Iiris'}`)
    ).resolves.toEqual({ id: 1, name: 'Iiris' }))

  it('unwraps the value if selecting a single column', () =>
    expect(
      queryMaybeOne(pool, sql`SELECT name FROM pet WHERE id = ${1}`)
    ).resolves.toEqual('Iiris'))

  it('executes a query and returns undefined if the result is empty', async () => {
    await expect(
      queryMaybeOne(pool, sql`SELECT * FROM pet WHERE name = ${'Nobody'}`)
    ).resolves.toBeUndefined()

    await expect(
      queryMaybeOne(pool, sql`SELECT name FROM pet WHERE name = ${'Nobody'}`)
    ).resolves.toBeUndefined()
  })

  it('throws an error if the result contains too many rows', () => {
    expect(queryMaybeOne(pool, sql`SELECT * FROM pet`)).rejects.toThrowError(
      TooManyRowsReturnedError
    )
  })
})

describe('execute()', () => {
  it('executes a query and returns the number of rows affected', async () => {
    await expect(
      execute(pool, sql`INSERT INTO pet (name) VALUES ('Bethany')`)
    ).resolves.toBe(1)

    await expect(
      execute(pool, sql`INSERT INTO pet (name) VALUES ('Bethany'), ('Fae')`)
    ).resolves.toBe(2)
  })
})

describe('transaction()', () => {
  it('executes a set of queries in a transaction, commiting the results', async () => {
    await expect(
      transaction(pool, (tx) =>
        execute(tx, sql`INSERT INTO pet (name) VALUES ('Bethany')`)
      )
    ).resolves.toEqual(1)

    await expect(query(pool, sql`SELECT name FROM pet`)).resolves.toEqual([
      'Iiris',
      'Jean',
      'Senna',
      'Bethany',
    ])
  })

  it('rolls back the transaction if an exception is thrown', async () => {
    await expect(
      transaction(pool, async (tx) => {
        await execute(
          tx,
          sql`INSERT INTO pet (name) VALUES ('Bethany') RETURNING id`
        )
        throw new Error('Boom!')
      })
    ).rejects.toThrowError(new Error('Boom!'))

    await expect(query(pool, sql`SELECT name FROM pet`)).resolves.toEqual([
      'Iiris',
      'Jean',
      'Senna',
    ])
  })

  it('accepts a checked-out client as well', async () => {
    const client = await pool.connect()
    try {
      await expect(
        transaction(client, (tx) => queryOne(tx, sql`SELECT count(*) FROM pet`))
      ).resolves.toEqual('3')
    } finally {
      client.release()
    }
  })
})
