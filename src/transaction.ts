import { Pool, PoolClient } from 'pg'

/**
 * Execute a function within a transaction.
 *
 * Start a transaction and execute a set of queries within it. If the function
 * returns a resolved promise, the transaction is committed. Returns the value
 * returned from the function.
 *
 * If the function returns a rejected Promise or throws any kind of error, the
 * transaction is rolled back and the error is rethrown.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param queries A function that executes a set of queries within the transaction.
 */
export async function withTransaction<T>(
  client: Pool | PoolClient,
  queries: (tx: PoolClient) => PromiseLike<T>
): Promise<T> {
  const tx = client instanceof Pool ? await client.connect() : client

  try {
    await tx.query('BEGIN')
    const result = await queries(tx)
    await tx.query('COMMIT')
    return result
  } catch (err) {
    await tx.query('ROLLBACK')
    throw err
  } finally {
    if (client instanceof Pool) {
      tx.release()
    }
  }
}
