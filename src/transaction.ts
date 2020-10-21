import { Pool, PoolClient } from 'pg'

/**
 * The isolation level to use within a transaction.
 *
 * See
 * {@link https://www.postgresql.org/docs/current/transaction-iso.html Transaction isolation}
 * in the PostgreSQL manual for more information.
 */
export enum IsolationLevel {
  /**
   * The default isolation level, determined by PostgreSQL's per-connection
   * `default_transaction_isolation` variable. By default, it corresponds to
   * `ReadCommitted`.
   */
  Default = 'DEFAULT',
  Serializable = 'SERIALIZABLE',
  RepeatableRead = 'REPEATABLE READ',
  ReadCommitted = 'READ COMMITTED',
}

/**
 * The access mode to use within a transaction.
 *
 * See
 * {@link https://www.postgresql.org/docs/current/sql-set-transaction.html SET TRANSACTION}
 * in the PostgreSQL manual for more information.
 */
export enum AccessMode {
  /**
   * The default access mode, determined by PostgreSQL's per-connection
   * `default_transaction_read_only` variable. By default, it corresponds to
   * `ReadWrite`.
   */
  Default = 'DEFAULT',
  ReadWrite = 'READ WRITE',
  ReadOnly = 'READ ONLY',
}

/**
 * The isolation level and access mode to use within a transaction.
 *
 * See
 * {@link https://www.postgresql.org/docs/current/transaction-iso.html Transaction isolation}
 * in the PostgreSQL manual for more information.
 */
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
 * does not throw an error, the transaction is committed. Returns the value
 * returned from the function.
 *
 * If the function throws any kind of error, the transaction is rolled back and
 * the error is rethrown.
 *
 * @param client A connection pool or a client checked out from a pool.
 * @param queries A set of queries to execute within the transaction.
 */
export function withTransaction<T>(
  client: Pool | PoolClient,
  queries: (tx: PoolClient) => PromiseLike<T>
): Promise<T> {
  return withTransactionMode(defaultTransactionMode, client, queries)
}

/**
 * Execute a set of queries within a transaction, using the given isolation
 * level.
 *
 * @param isolationLevel The isolation level to use.
 * @param client A connection pool or a client checked out from a pool.
 * @param queries A set of queries to execute within the transaction.
 */
export function withTransactionLevel<T>(
  isolationLevel: IsolationLevel,
  client: Pool | PoolClient,
  queries: (tx: PoolClient) => PromiseLike<T>
): Promise<T> {
  return withTransactionMode(
    { ...defaultTransactionMode, isolationLevel },
    client,
    queries
  )
}

/**
 * Execute a set of queries within a transaction, using the given isolation
 * level and access mode.
 *
 * @param transactionMode The isolation level and access mode to use.
 * @param client A connection pool or a client checked out from a pool.
 * @param queries A set of queries to execute within the transaction.
 */
export async function withTransactionMode<T>(
  transactionMode: TransactionMode,
  client: Pool | PoolClient,
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

/**
 * Execute a set of queries within a savepoint.
 *
 * Start a savepoint and execute a set of queries within it. If the function
 * does not throw an error, the savepoint is released. Returns the value
 * returned from the function.
 *
 * If the function throws any kind of error, the savepoint is rolled back and
 * the error is rethrown.
 *
 * May only be used within a transaction.
 *
 * @param tx A client belonging to a transaction.
 * @param queries A set of queries to execute within the savepoint.
 */
export async function withSavepoint<T>(
  tx: PoolClient,
  queries: () => PromiseLike<T>
): Promise<T> {
  try {
    await tx.query('SAVEPOINT possu_savepoint')
    const result = await queries()
    await tx.query('RELEASE SAVEPOINT possu_savepoint')
    return result
  } catch (err) {
    // no_active_sql_transaction https://www.postgresql.org/docs/current/errcodes-appendix.html
    if (err?.code !== '25P01') {
      await tx.query(
        'ROLLBACK TO SAVEPOINT possu_savepoint; RELEASE SAVEPOINT possu_savepoint'
      )
    }
    throw err
  }
}
