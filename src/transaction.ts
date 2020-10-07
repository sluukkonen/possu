import { Pool, PoolClient } from 'pg'

export enum IsolationLevel {
  Default = 'DEFAULT',
  Serializable = 'SERIALIZABLE',
  RepeatableRead = 'REPEATABLE READ',
  ReadCommitted = 'READ COMMITTED',
}

export enum AccessMode {
  Default = 'DEFAULT',
  ReadWrite = 'READ WRITE',
  ReadOnly = 'READ ONLY',
}

export interface TransactionMode {
  isolationLevel: IsolationLevel
  accessMode: AccessMode
}

const defaultTransactionMode: TransactionMode = {
  isolationLevel: IsolationLevel.Default,
  accessMode: AccessMode.Default,
}

/**
 * Execute a set of queries within a transaction.
 *
 * Start a transaction and execute a set of queries within it. If the function
 * returns a resolved promise, the transaction is committed. Returns the value
 * returned from the function.
 *
 * If the function returns a rejected Promise or throws any kind of error, the
 * transaction is rolled back and the error is rethrown.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param queries A set of queries to execute within the transaction.
 */
export function withTransaction<T>(
  client: Pool | PoolClient,
  queries: (tx: PoolClient) => PromiseLike<T>
): Promise<T> {
  return withTransactionMode(client, defaultTransactionMode, queries)
}

/**
 * Execute a set of queries within a transaction, using the given isolation
 * level.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param isolationLevel The isolation level to use.
 * @param queries A set of queries to execute within the transaction.
 */
export function withTransactionLevel<T>(
  client: Pool | PoolClient,
  isolationLevel: IsolationLevel,
  queries: (tx: PoolClient) => PromiseLike<T>
): Promise<T> {
  return withTransactionMode(
    client,
    { ...defaultTransactionMode, isolationLevel },
    queries
  )
}

/**
 * Execute a set of queries within a transaction, using the given isolation
 * level and access mode.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param transactionMode The isolation level and access mode to use.
 * @param queries A set of queries to execute within the transaction.
 */
export async function withTransactionMode<T>(
  client: Pool | PoolClient,
  transactionMode: TransactionMode,
  queries: (tx: PoolClient) => PromiseLike<T>
): Promise<T> {
  const beginStatement = getBeginStatement(transactionMode)
  const tx = client instanceof Pool ? await client.connect() : client

  try {
    await tx.query(beginStatement)
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

function getBeginStatement(transactionMode: TransactionMode): string {
  return (
    'BEGIN' +
    getIsolationLevel(transactionMode.isolationLevel) +
    getAccessMode(transactionMode.accessMode)
  )
}

function getIsolationLevel(isolationLevel: IsolationLevel): string {
  switch (isolationLevel) {
    case IsolationLevel.Default:
      return ''
    case IsolationLevel.ReadCommitted:
      return ' ISOLATION LEVEL READ COMMITTED'
    case IsolationLevel.RepeatableRead:
      return ' ISOLATION LEVEL REPEATABLE READ'
    case IsolationLevel.Serializable:
      return ' ISOLATION LEVEL SERIALIZABLE'
    default:
      throw new TypeError(`Invalid isolation level: ${isolationLevel}`)
  }
}

function getAccessMode(accessMode: AccessMode): string {
  switch (accessMode) {
    case AccessMode.Default:
      return ''
    case AccessMode.ReadWrite:
      return ' READ WRITE'
    case AccessMode.ReadOnly:
      return ' READ ONLY'
    default:
      throw new TypeError(`Invalid access mode: ${accessMode}`)
  }
}
