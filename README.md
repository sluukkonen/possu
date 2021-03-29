# Possu 🐖

[![CI](https://github.com/sluukkonen/possu/workflows/CI/badge.svg)](https://github.com/sluukkonen/possu/actions?query=workflow%3ACI)
[![Dependencies](https://img.shields.io/david/sluukkonen/possu)](https://david-dm.org/sluukkonen/possu)
![License](https://img.shields.io/npm/l/possu)
[![NPM](https://img.shields.io/npm/v/possu)](https://www.npmjs.com/package/possu)

A small companion library for [node-postgres](https://node-postgres.com/).

## Features & Goals

- A Promise-based API, which aims to reduce common boilerplate
- Write raw SQL queries with tagged template strings
- Prevent most types of accidental SQL injection vulnerabilities
- Transaction and savepoint handling, including retrying in case of
  serialization failures and deadlocks.
- First-class TypeScript support
- Not a framework. Most functions take a
  [pg.Pool](https://node-postgres.com/api/pool) or a
  [pg.PoolClient](https://node-postgres.com/api/client) as an argument, so you
  can integrate Possu easily to an existing application.

## Future plans

- More query builder features (e.g. arrays, unnesting)

## Getting started

```
$ npm install possu
```

```typescript
import { queryOne, sql } from 'possu'
import { Pool } from 'pg'

const db = new Pool({
  database: 'database-name',
  host: 'localhost',
  user: 'database-user',
  password: 'database-password',
})

const result = await queryOne(db, sql`SELECT id, name FROM pet WHERE name = ${'Napoleon'}`)
// => { id: 1, name: 'Napoleon' }
```

## API

- [Building queries](#building-queries)
  - [sql](#sql)
  - [sql.identifier](#user-content-sqlidentifier)
  - [sql.json](#user-content-sqljson)
  - [sql.values](#user-content-sqlvalues)
- [Executing queries](#executing-queries)
  - [query](#query)
  - [queryOne](#queryOne)
  - [queryMaybeOne](#queryMaybeOne)
  - [execute](#execute)
- [Transaction handling](#transaction-handling)
  - [withTransaction](#withTransaction)
  - [withSavepoint](#withSavepoint)

### Building queries

#### sql

```typescript
(parts: TemplateStringsArray, ...values: unknown[]) => SqlQuery
```

Create an SQL query.

This is the only way to create queries in Possu. To prevent accidental SQL injections, other
Possu functions check at runtime that the query has been created with `sql`.

```typescript
const query = sql`SELECT * FROM pet WHERE id = ${1}`
// => { text: 'SELECT * FROM pet WHERE id = $1', values: [1] }
```

Queries may also be nested within other queries. This is a powerful mechanism for code reuse.

```typescript
const query = sql`SELECT * FROM pet WHERE id = ${1}`
const exists = sql`SELECT exists(${query})`
// => { text: 'SELECT exists(SELECT * FROM pet WHERE id = $1)', values: [1] }
```

#### sql.identifier

```typescript
(name: string) => Identifier
```

Escape an SQL
[identifier](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
to be used in a query. It can be used to create queries which are
parametrized by table or column names.

```typescript
sql`SELECT * FROM ${sql.identifier('pet')}`
// => { text: 'SELECT * FROM "pet"', values: [] }
```

```typescript
sql`SELECT * FROM pet ORDER BY ${sql.identifier('name')} DESC`
// => { text: 'SELECT * FROM pet ORDER BY "name" DESC', values: [] }
```

#### sql.json

```typescript
(value: unknown) => string
```

Serialize a value as JSON to be used in a query.

```typescript
sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
// => { text : 'SELECT * FROM jsonb_array_elements($1)', values: ['[1,2,3]'] }
```

#### sql.values

```typescript
<T extends object, K extends keyof T>(objects: T[], ...keys: K[]) => ValuesList<T, K>
```

Construct a [VALUES
list](https://www.postgresql.org/docs/current/queries-values.html) from a
non-empty array of objects. Useful as a data source to `INSERT` queries or
when writing complex subqueries.

```typescript
sql`INSERT INTO pet (name, age) ${sql.values([
  { name: 'Iiris', age: 5 },
  { name: 'Napoleon', age: 11 },
])}`
// => { text: 'INSERT INTO pet (name, age) VALUES ($1, $2), ($3, $4)', values: ['Iiris', 5, 'Napoleon', 11] }
```

You can also customize the set of keys used.

```typescript
sql`INSERT INTO pet (name) ${sql.values(
  [
    { name: 'Iiris', age: 5 },
    { name: 'Napoleon', age: 11 },
  ],
  'name'
)}`
// => { text: 'INSERT INTO pet (name) VALUES ($1), ($2)', values: ['Iiris', 'Napoleon'] }
```

### Executing queries

Each of the query functions take a connection pool or a client checked out of
the pool as the first argument.

For queries that return result rows, you may also supply an optional row
parser, which can validate and transform the value of each row. This
can be useful when combined with a library like
[io-ts](https://github.com/gcanti/io-ts) or
[runtypes](https://github.com/pelotom/runtypes).

When using TypeScript, the type of each result row is `unknown` by default,
so you must either cast the result to the correct type or to use a row
parser that helps the TypeScript compiler infer the correct result type.

```typescript
import { Record, Number, String } from 'runtypes'

const result = await query<string>(db, sql`SELECT name FROM pet`)
// Type inferred to string[]

const Pet = Record({
  id: Number,
  name: String,
})

const pets = await query(db, sql`SELECT * FROM pet`, Pet.check)
// Type inferred to [{ id: number, name: string }]
```

#### query

```typescript
<T>(client: Pool | PoolClient, query: SqlQuery, rowParser?: (row: unknown) => T) => Promise<T[]>
```

Execute a `SELECT` or other query that returns zero or more rows.

Returns all rows.

```typescript
const pets = await query(db, sql`SELECT * FROM pet`)
// => [{ id: 1, name: 'Iiris' }, { id: 2, name: 'Jean' }]
```

If selecting a single column, each result row is unwrapped automatically.

```typescript
const names = await query(db, sql`SELECT name FROM pet`)
// => ['Iiris', 'Jean']
```

#### queryOne

```typescript
<T>(client: Pool | PoolClient, query: SqlQuery, rowParser?: (row: unknown) => T) => Promise<T>
```

Execute a `SELECT` or other query that returns exactly one row.

Returns the first row.

- Throws a `ResultError` if query doesn't return exactly one row.

```typescript
const pet = await queryOne(db, sql`SELECT id, name FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryOne(db, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

You can transform the result with a custom row parser. Here we transform the
count from a string to a number by using the built-in Number constructor.

```typescript
const count = await queryOne(db, sql`SELECT count(*) FROM pet`, Number)
// => 3
```

#### queryMaybeOne

```typescript
<T>(client: Pool | PoolClient, query: SqlQuery, rowParser?: (row: unknown) => T) => Promise<T | undefined>
```

Execute a `SELECT` or other query that returns zero or one rows.

Returns the first row or `undefined`.

- Throws a `ResultError` if query returns more than 1 row.

```typescript
const pet = await queryMaybeOne(db, sql`SELECT id, name FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }

const nil = await queryMaybeOne(db, sql`SELECT id, name FROM pet WHERE false`)
// => undefined
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryMaybeOne(db, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

#### execute

```typescript
(client: Pool | PoolClient, query: SqlQuery) => Promise<number>
```

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows.

Returns the number of rows affected.

```typescript
const rowCount = await execute(db, sql`INSERT INTO pet (name) VALUES ('Fae')`)
// => 1
```

### Transaction handling

#### withTransaction

```typescript
<T>(client: Pool | PoolClient, queries: (tx: PoolClient) => PromiseLike<T>, options?: TransactionOptions) => Promise<T>
```

Execute a set of queries within a transaction.

Start a transaction and execute a set of queries within it. If the function
does not throw an error, the transaction is committed.

If the function throws a non-retryable error, the transaction is rolled back
and the error is rethrown.

If the function throws a retryable error, the transaction is rolled back and
retried up to 2 or `maxRetries` times. By default, PostgreSQL errors codes
`40001` (serialization failure) and `40P01` (deadlock detected) are
considered to be retryable, but you may customize the behavior by supplying a
custom `shouldRetry` predicate.

You may also configure the [access
mode](https://www.postgresql.org/docs/current/sql-set-transaction.html) and
[isolation
level](https://www.postgresql.org/docs/current/transaction-iso.html) of the
transaction by supplying the `accessMode` and `isolationLevel` options,
respectively.

```typescript
const petCount = await withTransaction(db, async (tx) => {
  await execute(tx, sql`INSERT INTO pet (name) VALUES ('${'First'}')`)
  await execute(tx, sql`INSERT INTO pet (name) VALUES ('${'Second'}')`)
  await execute(tx, sql`INSERT INTO pet (name) VALUES ('${'Third'}')`)
  return queryOne(tx, sql`SELECT count(*) FROM pet`, Number)
})
```

#### withSavepoint

```typescript
<T>(tx: PoolClient, queries: (tx: PoolClient) => PromiseLike<T>) => Promise<T>
```

Execute a set of queries within a [savepoint](https://www.postgresql.org/docs/current/sql-savepoint.html).

Start a savepoint and execute a set of queries within it. If the function
does not throw an error, the savepoint is released.

If the function throws any kind of error, the savepoint is rolled back and
the error is rethrown.

May only be used within a transaction.

```typescript
await withTransaction(db, async (tx) => {
  await execute(tx, sql`INSERT INTO pet (name) VALUES ('First')`)
  return withSavepoint(tx, async (tx) => {
    await execute(tx, sql`INSERT INTO pet (name) VALUES ('Second')`)
    await execute(tx, sql`INSERT INTO pet (name) VALUES ('Third')`)
  }).catch((err) => {
    // Let the first insert to through if the second or third one fails.
  })
})
```
