import { Pool, PoolClient } from 'pg'
import { ResultError } from '../src/errors'
import { execute, query, queryMaybeOne, queryOne } from '../src/queries'
import { sql } from '../src/sql'
import { SqlQuery } from '../src/SqlQuery'
import { DatabaseError } from 'pg-protocol'
import { MessageName } from 'pg-protocol/dist/messages'
import {
  AccessMode,
  IsolationLevel,
  withSavepoint,
  withTransaction,
} from '../src/transaction'

let db: Pool

beforeAll(async () => {
  db = new Pool({ database: 'possu-test' })
  await db.query('DROP TABLE IF EXISTS users')
  await db.query(
    `CREATE TABLE users (
      id serial PRIMARY KEY,
      name text
    )`
  )
})

afterAll(() => db.end())

beforeEach(async () => {
  await withTransaction(db, (tx) =>
    execute(
      tx,
      sql`TRUNCATE TABLE users RESTART IDENTITY; INSERT INTO users (name) VALUES ('Alice'), ('Bob'), ('Charlie')`
    )
  )
})

const insertUser = (tx: PoolClient) =>
  execute(tx, sql`INSERT INTO users (name) VALUES ('Dave')`)
const getUserCount = (tx?: PoolClient) =>
  queryOne(tx ?? db, sql`SELECT count(*) FROM users`, Number)

describe('validation', () => {
  it('checks that queries have been constructed with the `sql` tagged template string', async () => {
    const fns: Array<
      (client: Pool | PoolClient, query: SqlQuery) => Promise<unknown>
    > = [query, queryOne, queryMaybeOne, execute]
    const parameters = [
      'SELECT * FROM users',
      { text: 'SELECT * FROM users', values: [] },
    ]

    for (const fn of fns) {
      for (const params of parameters) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(fn(db, params as any)).rejects.toThrow(
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
    expect(query(db, sql`SELECT * FROM users`)).resolves.toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]))

  it('unwraps the values if selecting a single column', () =>
    expect(query(db, sql`SELECT name FROM users`)).resolves.toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ]))

  it('supports an optional row parser', async () => {
    await expect(
      query(db, sql`SELECT * FROM users`, JSON.stringify)
    ).resolves.toEqual([
      JSON.stringify({ id: 1, name: 'Alice' }),
      JSON.stringify({ id: 2, name: 'Bob' }),
      JSON.stringify({ id: 3, name: 'Charlie' }),
    ])
    await expect(
      query(db, sql`SELECT name FROM users`, JSON.stringify)
    ).resolves.toEqual([
      JSON.stringify('Alice'),
      JSON.stringify('Bob'),
      JSON.stringify('Charlie'),
    ])
  })
})

describe('queryOne()', () => {
  it('executes a query and returns the first row', () =>
    expect(
      queryOne(db, sql`SELECT * FROM users WHERE name = ${'Alice'}`)
    ).resolves.toEqual({
      id: 1,
      name: 'Alice',
    }))

  it('unwraps the value if selecting a single column', () =>
    expect(
      queryOne(db, sql`SELECT name FROM users WHERE id = ${1}`)
    ).resolves.toEqual('Alice'))

  it('throws an error if the result contains too many rows', () => {
    const query = sql`SELECT * FROM users`

    return expect(queryOne(db, query)).rejects.toThrowError(
      new ResultError('Expected query to return exactly 1 row, got 3', query)
    )
  })

  it('throws an error if the result is empty', () => {
    const query = sql`SELECT * FROM users WHERE name = ${'Nobody'}`

    return expect(queryOne(db, query)).rejects.toThrowError(
      new ResultError('Expected query to return exactly 1 row, got 0', query)
    )
  })

  it('supports an optional row parser', async () => {
    await expect(
      queryOne(
        db,
        sql`SELECT * FROM users WHERE name = ${'Alice'}`,
        JSON.stringify
      )
    ).resolves.toEqual(JSON.stringify({ id: 1, name: 'Alice' }))
    await expect(
      queryOne(db, sql`SELECT count(*) FROM users`, Number)
    ).resolves.toEqual(3)
  })
})

describe('queryMaybeOne()', () => {
  it('executes a query and returns the first row, if it exists', () =>
    expect(
      queryMaybeOne(db, sql`SELECT * FROM users WHERE name = ${'Alice'}`)
    ).resolves.toEqual({ id: 1, name: 'Alice' }))

  it('unwraps the value if selecting a single column', () =>
    expect(
      queryMaybeOne(db, sql`SELECT name FROM users WHERE id = ${1}`)
    ).resolves.toEqual('Alice'))

  it('executes a query and returns undefined if the result is empty', async () => {
    await expect(
      queryMaybeOne(db, sql`SELECT * FROM users WHERE name = ${'Nobody'}`)
    ).resolves.toBeUndefined()

    await expect(
      queryMaybeOne(db, sql`SELECT name FROM users WHERE name = ${'Nobody'}`)
    ).resolves.toBeUndefined()
  })

  it('throws an error if the result contains too many rows', () => {
    const query = sql`SELECT * FROM users`
    return expect(queryMaybeOne(db, query)).rejects.toThrowError(
      new ResultError('Expected query to return 0–1 rows, got 3', query)
    )
  })

  it('supports an optional row parser', async () => {
    await expect(
      queryMaybeOne(
        db,
        sql`SELECT * FROM users WHERE name = ${'Alice'}`,
        JSON.stringify
      )
    ).resolves.toEqual(JSON.stringify({ id: 1, name: 'Alice' }))
    await expect(
      queryMaybeOne(
        db,
        sql`SELECT name FROM users WHERE name = ${'Alice'}`,
        JSON.stringify
      )
    ).resolves.toEqual(JSON.stringify('Alice'))
  })
})

describe('execute()', () => {
  it('executes a query and returns the number of rows affected', async () => {
    await expect(
      execute(db, sql`INSERT INTO users (name) VALUES ('Bethany')`)
    ).resolves.toBe(1)

    await expect(
      execute(db, sql`INSERT INTO users (name) VALUES ('Bethany'), ('Fae')`)
    ).resolves.toBe(2)
  })
})

describe('transaction()', () => {
  it('executes a set of queries in a transaction, commiting the results', async () => {
    await expect(getUserCount()).resolves.toBe(3)
    await withTransaction(db, insertUser)
    await expect(getUserCount()).resolves.toBe(4)
  })

  it('returns the value returned by the function', async () => {
    const result = await withTransaction(db, async (tx) => {
      await insertUser(tx)
      return 42
    })
    expect(result).toBe(42)
  })

  it('rolls back the transaction if the function returns a rejected promise', async () => {
    await expect(
      withTransaction(db, async (tx) => {
        await insertUser(tx)
        throw new Error('Boom!')
      })
    ).rejects.toThrowError(new Error('Boom!'))
    await expect(getUserCount()).resolves.toBe(3)
  })

  it('rolls back the transaction if the function throws an error', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withTransaction(db, (tx) => (insertUser(tx) as any).than(Number)) // Intentional typo
    ).rejects.toThrowError(
      new TypeError('insertUser(...).than is not a function')
    )
  })

  it('throws an error and does not execute the function if it fails to check out a connection from the pool', async () => {
    const failPool = new Pool({ port: 54321 })
    const fn = jest.fn()
    await expect(withTransaction(failPool, fn)).rejects.toThrowError(
      new Error('connect ECONNREFUSED 127.0.0.1:54321')
    )
    expect(fn).toHaveBeenCalledTimes(0)
  })

  describe('validation', () => {
    it('validates isolationLevel', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withTransaction(db, async (x) => x, { isolationLevel: null as any })
      ).rejects.toThrowError(new TypeError('Invalid isolation level: null'))
    })

    it('validates accessMode', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withTransaction(db, async (x) => x, { accessMode: null as any })
      ).rejects.toThrowError(new TypeError('Invalid access mode: null'))
    })

    it('validates maxRetries', async () => {
      await expect(
        withTransaction(db, async (x) => x, { maxRetries: -1 })
      ).rejects.toThrowError(
        new TypeError('maxRetries must be a non-negative integer!')
      )
    })

    it('validates shouldRetry', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withTransaction(db, async (x) => x, { shouldRetry: 'yes' as any })
      ).rejects.toThrowError(new TypeError('shouldRetry must be a function!'))
    })
  })

  describe('retrying', () => {
    const serializationError = new DatabaseError('', 0, MessageName.error)
    serializationError.code = '40001'

    const deadlockDetectedError = new DatabaseError('', 0, MessageName.error)
    deadlockDetectedError.code = '40P01'

    it.each([[serializationError], [deadlockDetectedError]])(
      'retries queries upto 2 times for retryable errors',
      async (error) => {
        const fn = jest.fn(async (tx: PoolClient) => {
          await insertUser(tx)
          throw error
        })
        await expect(withTransaction(db, fn)).rejects.toThrowError(error)
        await expect(getUserCount()).resolves.toBe(3)
        expect(fn).toHaveBeenCalledTimes(3)
      }
    )

    it('retries queries upto maxRetries times', async () => {
      const fn = jest.fn(async (tx: PoolClient) => {
        await insertUser(tx)
        throw serializationError
      })
      await expect(
        withTransaction(db, fn, { maxRetries: 10 })
      ).rejects.toThrowError(serializationError)
      await expect(getUserCount()).resolves.toBe(3)
      expect(fn).toHaveBeenCalledTimes(11)
    })

    it('does not retry if maxRetries is 0', async () => {
      const fn = jest.fn(async (tx: PoolClient) => {
        await insertUser(tx)
        throw serializationError
      })
      await expect(
        withTransaction(db, fn, { maxRetries: 0 })
      ).rejects.toThrowError(serializationError)
      await expect(getUserCount()).resolves.toBe(3)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('does not retry on non-retryable errors', async () => {
      const fn = jest.fn(async (tx: PoolClient) => {
        await insertUser(tx)
        throw new Error('Boom!')
      })
      await expect(withTransaction(db, fn)).rejects.toThrowError('Boom!')
      await expect(getUserCount()).resolves.toBe(3)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('supports custom shouldRetry predicates', async () => {
      const fn = jest.fn(async (tx: PoolClient) => {
        await insertUser(tx)
        throw new Error('Boom!')
      })
      await expect(
        withTransaction(db, fn, { shouldRetry: () => true })
      ).rejects.toThrowError('Boom!')
      await expect(getUserCount()).resolves.toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe.each([
    [IsolationLevel.Default, 'read committed'],
    [IsolationLevel.ReadCommitted, 'read committed'],
    [IsolationLevel.RepeatableRead, 'repeatable read'],
    [IsolationLevel.Serializable, 'serializable'],
  ])(
    'sets the correct isolation level (%s -> %s)',
    (isolationLevel, isolationLevelResult) => {
      it.each([
        [AccessMode.Default, 'off'],
        [AccessMode.ReadWrite, 'off'],
        [AccessMode.ReadOnly, 'on'],
      ])(
        'and the correct access mode (%s -> %s)',
        async (accessMode, accessModeResult) => {
          await withTransaction(
            db,
            async (tx) => {
              expect(await queryOne(tx, sql`SHOW transaction_isolation`)).toBe(
                isolationLevelResult
              )
              expect(await queryOne(tx, sql`SHOW transaction_read_only`)).toBe(
                accessModeResult
              )
            },
            { isolationLevel, accessMode: accessMode }
          )
        }
      )
    }
  )
})

describe('withSavepoint()', () => {
  it('throws an error if called with a pool', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withSavepoint(db as any, () => query(db, sql`SELECT 1`))
    ).rejects.toThrowError('SAVEPOINT can only be used in transaction blocks')
  })
  it('throws an error if called outside a transaction', async () => {
    const client = await db.connect()
    try {
      await expect(
        withSavepoint(client, () => query(client, sql`SELECT 1`))
      ).rejects.toThrowError('SAVEPOINT can only be used in transaction blocks')
    } finally {
      client.release()
    }
  })

  it('returns the value from the function', async () => {
    await expect(
      withTransaction(db, (tx) => withSavepoint(tx, async () => 'foo'))
    ).resolves.toBe('foo')
  })

  it('does not blow up if throwing a non-Error', async () => {
    await expect(
      withTransaction(db, (tx) =>
        withSavepoint(tx, async () => {
          throw null
        })
      )
    ).rejects.toBeNull()
  })

  it('rolls back the savepoint if an error is thrown', async () => {
    await withTransaction(db, async (tx) => {
      await insertUser(tx)
      await withSavepoint(tx, async (tx) => {
        await insertUser(tx)
        throw new Error('Boom!')
      })
        .then(() => {
          throw new Error('Should not happen!')
        })
        .catch((err) => {
          expect(err.message).toBe('Boom!')
        })
    })
    expect(await getUserCount()).toBe(4)
  })

  it('rethrows an error after rolling back', async () => {
    await expect(
      withTransaction(db, async (tx) => {
        await insertUser(tx)
        await withSavepoint(tx, async (tx) => {
          await insertUser(tx)
          throw new Error('Boom!')
        })
      })
    ).rejects.toThrowError(new Error('Boom!'))
    expect(await getUserCount()).toBe(3)
  })

  it('can be nested (catch on 1st level)', async () => {
    await withTransaction(db, async (tx) => {
      await insertUser(tx)
      await withSavepoint(tx, async (tx) => {
        await insertUser(tx)
        await withSavepoint(tx, async (tx) => {
          await insertUser(tx)
          throw new Error('Boom!')
        })
      })
        .then(() => {
          throw new Error('Should not happen!')
        })
        .catch((err) => {
          expect(err.message).toBe('Boom!')
        })
    })
    expect(await getUserCount()).toBe(4)
  })

  it('can be nested (catch on 2nd level)', async () => {
    await withTransaction(db, async (tx) => {
      await insertUser(tx)
      await withSavepoint(tx, async (tx) => {
        await insertUser(tx)
        await withSavepoint(tx, async (tx) => {
          await insertUser(tx)
          throw new Error('Boom!')
        })
          .then(() => {
            throw new Error('Should not happen!')
          })
          .catch((err) => {
            expect(err.message).toBe('Boom!')
          })
      })
    })
    expect(await getUserCount()).toBe(5)
  })

  it('can be nested (no catch)', async () => {
    await expect(
      withTransaction(db, async (tx) => {
        await insertUser(tx)
        await withSavepoint(tx, async (tx) => {
          await insertUser(tx)
          await withSavepoint(tx, async (tx) => {
            await insertUser(tx)
            throw new Error('Boom!')
          })
        })
      })
    ).rejects.toThrowError('Boom!')
    expect(await getUserCount()).toBe(3)
  })
})
