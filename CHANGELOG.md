# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Changed

- Added an `exports` section to package.json, so you can no longer import internal Possu modules (
  e.g. `import SqlQuery from "possu/dist/SqlQuery"`).

## [2.0.0] - 2023-08-01

### Added

- Exported the `Sql` interface. Thanks [@timosaikkonen](https://github.com/timosaikkonen).

### Changed

- Drop support for Node 14.x

## [1.0.0] - 2022-09-22

### Added

- Add new [`executeOne`](README.md#executeone) and [`executeMaybeOne`](README.md#executeMaybeOne) functions as the duals
  of [`queryOne`](README.md#queryOne) and [`queryMaybeOne`](README.md#queryMaybeOne). They will throw a `ResultError`
  if the query modifies different than the expected amount of rows.

### Changed

- Drop support for Node 12.x

## [0.12.0] - 2022-03-30

### Changed

- Bump the minimum required version of `pg` and `@types/pg` to 8.6.0.
- Change ``sql`...`.prepare('query-name')`` to return a new copy of the query instead of mutating it.
- Bump minimum Node.js version to 12.x
- Change the signature of the `shouldRetry` option of `withTransaction` from `(error: Error) => boolean` to
  `(error: unknown) => boolean`. This matches
  the [default error type of catch clauses in TypeScript 4.4](https://devblogs.microsoft.com/typescript/announcing-typescript-4-4/#use-unknown-catch-variables).
- Catch any errors emitted by the client in `withTransaction`. A `pg.Client` is an EventEmitter, which will crash the
  Node.js process if it emits an error an if there are no error listeners. Possu will now automatically install an error
  handler that catches any errors emitted by the client during the transaction. Any errors are returned in the promise.

## [0.11.0] - 2021-04-10

### Added

- Added an ``sql`...`.prepare('query-name')`` method for creating prepared statements. This can
  sometimes have measurable performance benefits, especially if the query is very complex to parse and plan.
- Added a `Connection` type alias for `pg.Pool | pg.PoolClient`. It is designed to be used in your query functions as
  a generic connection type.

```typescript
import { Connection, query, sql } from 'possu'

export function getUsers(conn: Connection) {
  return query(conn, sql`SELECT * FROM users`)
}
```

- Added `Transaction` type. It is just a regular `pg.PoolClient` with a type-level brand, which indicates that the
  connection has an active transaction. It can be used as additional type safety in functions that must be called within
  a transaction.

```typescript
import { Transaction, query, sql } from 'possu'

export async function insertTwoUsers(tx: Transaction) {
  await execute(tx, sql`INSERT INTO users (name) VALUES ('Alice')`)
  await execute(tx, sql`INSERT INTO users (name) VALUES ('Bob')`)
}
```

### Changed

- Changed [`withTransaction`](README.md#withtransaction) to only take a connection pool as the first argument.
- Changed [`withSavePoint`](README.me#withSavepoint) to take a `Transaction` as the first parameter.

## [0.10.0] - 2021-03-31

### Changed

- Improve the error message of [`queryMaybeOne`](README.md#queryMaybeOne) in cases where
  the query returns an unexpected amount of rows.
- Make private properties of `SqlQuery` non-enumerable
- Improve documentation

### Removed

- Removed `sql.values`. The existing implementation suffered from problems with the ordering of object keys. In most
  cases, the use of VALUES lists may be replaced with functions like `jsonb_to_recordset`, so I'm removing `sql.values`
  for now. If it proves to be useful in the future, it may come back in some form.

## [0.9.0] - 2021-01-26

### Added

- Added a new [`sql.values`](README.md#values) query builder for creating
  [VALUES lists](https://www.postgresql.org/docs/current/queries-values.html).
  Useful as a data source to `INSERT` queries or when writing complex subqueries.

## [0.8.0] - 2020-11-04

### Added

- Added automatic transaction retrying in
  [`withTransaction`](README.md#withTransaction) for PostgreSQL's `40001`
  (serialization failure) and `40P01` (deadlock detected) error codes.
- Added an optional options object to
  [`withTransaction`](README.md#withTransaction), which can be used to
  configure the access mode, isolation level and retry logic of a transaction.
- The set of queries in [`withSavepoint`](README.md#withSavepoint) now
  receives a `PoolClient` as an argument. With the change, one may supply the
  same function to both [`withTransaction`](README.md#withTransaction) and
  [`withSavepoint`](README.md#withSavepoint).

### Removed

- `withTransactionMode` and `withTransactionLevel` have been removed, since
  [`withTransaction`](README.md#withTransaction) now encompasses
  their functionality.

## [0.7.0] - 2020-10-22

### Changed

- Documentation improvements

## [0.6.0] - 2020-10-21

### Added

- Added a [`withSavepoint`](README.md#withSavepoint) function for creating
  savepoints. Savepoints can be used to simulate nested transactions.

## [0.5.0] - 2020-10-19

### Added

- Added a [`sql.json`](README.md#user-content-sqljson) function for serializing values as JSON in queries.
  Strictly speaking, this isn't necessary, since it is mostly just equivalent
  to `JSON.stringify`, but I'm including it since it might be more readable.
- Added an optional row parser parameter to [`query`](README.md#query),
  [`queryOne`](README.md#queryOne) and [`queryMaybeOne`](README.md#queryMaybeOne).

### Changed

- Changed the default type variable in [`query`](README.md#query),
  [`queryOne`](README.md#queryOne) and
  [`queryMaybeOne`](README.md#queryMaybeOne) from `any` to `unknown`. Now the
  user must explicitly cast the result rows to another type or to use a
  validating row parser.

## [0.4.0] - 2020-10-09

### Fixed

- Fixed the `files` and `types` entries in package.json. With them, the
  project should actually be usable 🙂.

## [0.3.0] - 2020-10-09

### Changed

- Changed `withTransactionLevel` and `withTransactionMode` to take the
  isolation level and access mode as the first argument. This allows the user
  to fix them more easily with e.g. `Function.prototype.bind`.
- Replaced `TooManyRowsReturnedError` and `NoRowsReturnedError` with a generic
  `ResultError`, which signifies that a query returned an unexpected result.

## [0.2.0] - 2020-10-08

### Added

- Added [`withTransactionLevel`](README.md#withTransactionLevel)
  and [`withTransactionMode`](README.md#withTransactionMode).

### Changed

- Renamed `transaction` to [`withTransaction`](README.md#withTransaction).

## [0.1.0] - 2020-10-07

- Initial public release
