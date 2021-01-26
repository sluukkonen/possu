# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
