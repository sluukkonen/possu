import { Pool, PoolClient } from 'pg'
import { Client } from './queries'

export async function transaction<T>(
  client: Client,
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
