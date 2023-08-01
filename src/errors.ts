import type { SqlQuery } from './SqlQuery'

/** The base class for all errors in Possu. */
export class PossuError extends Error {}
PossuError.prototype.name = 'PossuError'

/**
 * An error signifying that a query returned an unexpected result.
 */
export class ResultError extends PossuError {
  constructor(
    message: string,
    public query: SqlQuery,
  ) {
    super(message)
  }
}
ResultError.prototype.name = 'ResultError'
