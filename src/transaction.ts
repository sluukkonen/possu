import * as pg from 'pg'
import { isFunction } from './util'

const serializationFailure = '40001'
const deadlockDetected = '40P01'
const noActiveSqlTransaction = '25P01'

/**
 * A connection that has an active transaction.
 *
 * Note that the `__transaction` property exists purely at the type level.
 */
export type Transaction = pg.PoolClient & { readonly __possuTransaction: true }

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

export interface TransactionOptions {
  /**
   * The access mode of the transaction. It may be either:
   *
   * - `AccessMode.Default`
   * - `AccessMode.ReadWrite`
   * - `AccessMode.ReadOnly`
   *
   * See
   * {@link https://www.postgresql.org/docs/current/sql-set-transaction.html SET TRANSACTION}
   * in the PostgreSQL manual for more information.
   */
  accessMode?: AccessMode
  /**
   * The isolation level of the transaction. It may be either:
   *
   * - `IsolationLevel.Default`
   * - `IsolationLevel.Serializable`
   * - `IsolationLevel.RepeatableRead`
   * - `IsolationLevel.ReadCommitted`
   *
   * See
   * {@link https://www.postgresql.org/docs/current/transaction-iso.html Transaction isolation}
   * in the PostgreSQL manual for more information.
   */
  isolationLevel?: IsolationLevel
  /**
   * The maximum number of times to retry the transaction. Defaults to 2.
   */
  maxRetries?: number
  /**
   * Whether to retry the transaction in case of an error. By default,
   * PostgreSQL errors codes `40001` (serialization failure) and `40P01`
   * (deadlock detected) are considered to be retryable.
   */
  shouldRetry?: (error: unknown) => boolean
}

const defaultTransactionOptions: TransactionOptions = {}

/**
 * Execute a set of queries within a transaction.
 *
 * Start a transaction and execute a set of queries within it. If the function
 * does not throw an error, the transaction is committed.
 *
 * If the function throws a non-retryable error, the transaction is rolled back
 * and the error is rethrown.
 *
 * If the function throws a retryable error, the transaction is rolled back and
 * retried up to 2 or `maxRetries` times. By default, PostgreSQL errors codes
 * `40001` (serialization failure) and `40P01` (deadlock detected) are
 * considered to be retryable, but you may customize the behavior by supplying
 * a custom `shouldRetry` predicate.
 *
 * You may also configure the access mode mode and isolation level of the
 * transaction by supplying the `accessMode` and `isolationLevel` options,
 * respectively.
 *
 * @param pool A connection pool.
 * @param queries A set of queries to execute within the transaction.
 * @param options An optional options object.
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  queries: (tx: Transaction) => PromiseLike<T>,
  options: TransactionOptions = defaultTransactionOptions,
): Promise<T> {
  const begin = getBegin(options.isolationLevel, options.accessMode)
  const shouldRetry = getShouldRetry(options.shouldRetry)
  const maxRetries = getMaxRetries(options.maxRetries)
  const tx = await pool.connect()

  return new Promise((resolve, reject) => {
    let errored = false
    const onError = (error: unknown) => {
      // Ensure the client is released only once.
      if (errored) return
      errored = true
      tx.removeListener('error', onError)
      tx.release(true)
      reject(error)
    }
    const onResult = (result: T) => {
      tx.removeListener('error', onError)
      tx.release()
      resolve(result)
    }

    tx.once('error', onError)

    performTransaction(tx, begin, queries, shouldRetry, maxRetries)
      .then(onResult)
      .catch(onError)
  })
}

function getBegin(
  isolationLevel?: IsolationLevel,
  accessMode?: AccessMode,
): string {
  return 'BEGIN' + getIsolationLevel(isolationLevel) + getAccessMode(accessMode)
}

function getIsolationLevel(isolationLevel?: IsolationLevel): string {
  switch (isolationLevel) {
    case undefined:
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

function getAccessMode(accessMode?: AccessMode): string {
  switch (accessMode) {
    case undefined:
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

function getShouldRetry(shouldRetry?: (error: unknown) => boolean) {
  if (shouldRetry === undefined) {
    return isRetryableError
  } else if (!isFunction(shouldRetry)) {
    throw new TypeError(`shouldRetry must be a function!`)
  } else {
    return shouldRetry
  }
}

function getMaxRetries(maxRetries?: number): number {
  if (maxRetries === undefined) {
    return 2
  } else if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new TypeError(`maxRetries must be a non-negative integer!`)
  } else {
    return maxRetries
  }
}

async function performTransaction<T>(
  tx: pg.PoolClient,
  begin: string,
  queries: (tx: Transaction) => PromiseLike<T>,
  shouldRetry: (error: unknown) => boolean,
  maxRetries: number,
): Promise<T> {
  for (;;) {
    try {
      await tx.query(begin)
      const result = await queries(tx as Transaction)
      await tx.query('COMMIT')
      return result
    } catch (err) {
      await tx.query('ROLLBACK')

      if (maxRetries > 0 && shouldRetry(err)) {
        maxRetries -= 1
        continue
      }

      throw err
    }
  }
}

function isRetryableError(error: unknown) {
  if (error instanceof pg.DatabaseError) {
    const code = error.code
    return code === serializationFailure || code === deadlockDetected
  } else {
    return false
  }
}

function isNoActiveTransactionError(err: unknown) {
  return err instanceof pg.DatabaseError && err.code === noActiveSqlTransaction
}

/**
 * Execute a set of queries within a
 * {@link https://www.postgresql.org/docs/current/sql-savepoint.html savepoint}.
 *
 * Start a savepoint and execute a set of queries within it. If the function
 * does not throw an error, the savepoint is released.
 *
 * If the function throws any kind of error, the savepoint is rolled back and
 * the error is rethrown.
 *
 * May only be used within a transaction.
 *
 * @param tx A connection belonging to a transaction.
 * @param queries A set of queries to execute within the savepoint.
 */
export async function withSavepoint<T>(
  tx: Transaction,
  queries: (tx: Transaction) => PromiseLike<T>,
): Promise<T> {
  try {
    await tx.query('SAVEPOINT possu_savepoint')
    const result = await queries(tx)
    await tx.query('RELEASE SAVEPOINT possu_savepoint')
    return result
  } catch (err) {
    if (!isNoActiveTransactionError(err)) {
      await tx.query(
        'ROLLBACK TO SAVEPOINT possu_savepoint; RELEASE SAVEPOINT possu_savepoint',
      )
    }

    throw err
  }
}
