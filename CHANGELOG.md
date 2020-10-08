# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Changed `withTransactionLevel` and `withTransactionMode` to take the
  isolation level and access mode as the first argument. This allows the user
  to fix them more easily with e.g. `Function.prototype.bind`.

## [0.2.0] - 2020-10-08

### Added

- Added [`withTransactionLevel`](README.md#withTransactionLevel)
  and [`withTransactionMode`](README.md#withTransactionMode).

### Changed

- Renamed `transaction` to [`withTransaction`](README.md#withTransaction).

## [0.1.0] - 2020-10-07

- Initial public release
