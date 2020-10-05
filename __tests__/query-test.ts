import { Pool, PoolClient } from 'pg'
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  it('throws an error if the result contains too many rows', () =>
    expect(queryMaybeOne(pool, sql`SELECT * FROM pet`)).rejects.toThrowError(
      TooManyRowsReturnedError
    ))
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
  const insertPet = (tx: PoolClient) =>
    execute(tx, sql`INSERT INTO pet (name) VALUES ('Bethany')`)
  const getPetCount = () =>
    query(pool, sql`SELECT count(*) FROM pet`).then(Number)

  it('executes a set of queries in a transaction, commiting the results', async () => {
    await expect(getPetCount()).resolves.toBe(3)
    await transaction(pool, insertPet)
    await expect(getPetCount()).resolves.toBe(4)
  })

  it('returns the value returned by the function', async () => {
    const result = await transaction(pool, async (tx) => {
      await insertPet(tx)
      return 42
    })
    expect(result).toBe(42)
  })

  it('rolls back the transaction if the function returns a rejected promise', async () => {
    await expect(
      transaction(pool, async (tx) => {
        await insertPet(tx)
        throw new Error('Boom!')
      })
    ).rejects.toThrowError(new Error('Boom!'))
    await expect(getPetCount()).resolves.toBe(3)
  })

  it('rolls back the transaction if the function throws an error', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction(pool, (tx) => (insertPet(tx) as any).than(Number)) // Intentional typo
    ).rejects.toThrowError(
      new TypeError('insertPet(...).than is not a function')
    )
  })

  it('throws an error and does not execute the function if it fails to check out a connection from the pool', async () => {
    const failPool = new Pool({ port: 54321 })
    const fn = jest.fn()
    await expect(transaction(failPool, fn)).rejects.toThrowError(
      new Error('connect ECONNREFUSED 127.0.0.1:54321')
    )
    expect(fn).toHaveBeenCalledTimes(0)
  })

  it('accepts a checked-out client as well', async () => {
    const client = await pool.connect()
    try {
      await transaction(client, insertPet)
      await expect(getPetCount()).resolves.toEqual(4)
    } finally {
      client.release()
    }
  })
})
