import type { SqlQuery } from './SqlQuery'

export class PossuError extends Error {}
PossuError.prototype.name = 'PossuError'

export class NoRowsReturnedError extends PossuError {
  query: SqlQuery
  constructor(message: string, query: SqlQuery) {
    super(message)
    this.query = query
  }
}
NoRowsReturnedError.prototype.name = 'NoRowsReturnedError'

export class TooManyRowsReturnedError extends PossuError {
  query: SqlQuery
  constructor(message: string, query: SqlQuery) {
    super(message)
    this.query = query
  }
}
TooManyRowsReturnedError.prototype.name = 'TooManyRowsReturnedError'
