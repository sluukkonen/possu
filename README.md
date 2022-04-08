# Possu 🐖

[![CI](https://github.com/sluukkonen/possu/workflows/CI/badge.svg)](https://github.com/sluukkonen/possu/actions?query=workflow%3ACI)
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
- Not a framework. Most Possu functions take either a
  [pg.Pool](https://node-postgres.com/api/pool) or a
  [pg.PoolClient](https://node-postgres.com/api/client) as an argument, so you
  can integrate Possu easily to an existing application.

## Table of Contents

- [Installation](#installation)
- [Getting started](#getting-started)
- [API](#api)
  - [Building queries](#building-queries)
    - [sql](#sql)
    - [sql.identifier](#user-content-sqlidentifier)
    - [sql.json](#user-content-sqljson)
  - [Executing queries](#executing-queries)
    - [query](#query)
    - [queryOne](#queryOne)
    - [queryMaybeOne](#queryMaybeOne)
    - [execute](#execute)
    - [executeOne](#executeOne)
    - [executeMaybeOne](#executeMaybeOne)
  - [Transaction handling](#transaction-handling)
    - [withTransaction](#withTransaction)
    - [withSavepoint](#withSavepoint)

## Installation

Run either

```shell
$ npm install possu
```

or

```shell
$ yarn add possu
```

depending on your favourite package manager.

## Getting started

If you've ever written an application using
[node-postgres](https://node-postgres.com/), a lot of your database code
might look a bit like this:

```typescript
async function getUser(tx, userId) {
  const result = await tx.query('SELECT * FROM users WHERE user_id = $1', [
    userId,
  ])
  return result.rows[0]
}
```

In addition to the SQL query, there is some boilerplate code that selects the
correct amount of rows from the query result. In a large application, this
can get quite repetetive. Things can even more complicated if you're only
interested in a single column from the result set.

```typescript
async function getUserNames(tx) {
  const result = await tx.query('SELECT name FROM users')
  return result.rows.map((row) => row.name)
}
```

The goal of Possu is to eliminate this kind of boilerplate code from your
application.

```typescript
import { query, queryMaybeOne, sql } from 'possu'

function getUser(tx, userId) {
  return queryMaybeOne(tx, sql`SELECT * FROM users WHERE user_id = ${userId}`)
}

function getUserNames(tx) {
  return query(tx, sql`SELECT name FROM users`)
}
```

Here we use Possu's `sql` tagged template literal for constructing the
queries, while `query` and `queryMaybeOne` functions contain the necessary
code for selecting the correct amount of rows from the result set.

In the `getUserNames` function, possu automatically unwraps the `name` column
from each row, since in most cases, an extra object wrapper in the results of
a single-column query is just extra noise.

That's it! This was not an exhaustive tour of Possu, but it should be enough
to get an idea of its main features.

## API

### Building queries

#### sql

<!-- prettier-ignore-start -->
```typescript
(parts: TemplateStringsArray, ...values: unknown[]) => SqlQuery
```
<!-- prettier-ignore-end -->

Create an SQL query.

This is the only way to create queries in Possu. To prevent accidental SQL injections, other
Possu functions check at runtime that the query has been created with `sql`.

**Example:**

```typescript
const query = sql`SELECT * FROM users WHERE user_id = ${1}`
// => SqlQuery { text: 'SELECT * FROM users WHERE user_id = $1', values: [1] }
```

Queries may be nested within other queries, which can be a powerful mechanism for code reuse.

```typescript
const usersQuery = sql`SELECT * FROM users WHERE user_id = ${1}`
const existsQuery = sql`SELECT exists(${usersQuery})`
// => SqlQuery { text: 'SELECT exists(SELECT * FROM users WHERE user_id = $1)', values: [1] }
```

Nested queries can also be used to customize parts of a query without having to worry about SQL injections.

```typescript
const order = 'asc'
const query = sql`SELECT * FROM users ORDER BY name ${
  order === 'asc' ? sql`ASC` : sql`DESC`
}`
// => SqlQuery { text: 'SELECT * FROM users ORDER BY name ASC', values: [] }
```

Calling the `.prepare()` method on a query causes it be executed as a prepared statement.

This can sometimes have measurable performance benefits, especially if the query is very complex to parse and plan.

See the [PostgreSQL manual](https://www.postgresql.org/docs/current/sql-prepare.html)
for more information.

```typescript
sql`SELECT * FROM users`.prepare('fetch-users')
// => SqlQuery { text: 'SELECT * FROM users', values: [], name: 'fetch-users' }
```

---

#### sql.identifier

<!-- prettier-ignore-start -->
```typescript
(name: string) => Identifier
```
<!-- prettier-ignore-end -->

Escape an SQL
[identifier](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
to be used in a query. It can be used to create queries which are
parametrized by table or column names.

**Example:**

```typescript
sql`SELECT * FROM ${sql.identifier('users')}`
// => SqlQuery { text: 'SELECT * FROM "users"', values: [] }
```

```typescript
sql`SELECT * FROM users ORDER BY ${sql.identifier('name')} DESC`
// => SqlQuery { text: 'SELECT * FROM users ORDER BY "name" DESC', values: [] }
```

---

#### sql.json

<!-- prettier-ignore-start -->
```typescript
(value: unknown) => string
```
<!-- prettier-ignore-end -->

Serialize a value as JSON to be used in a query.

**Example:**

```typescript
sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
// => SqlQuery { text : 'SELECT * FROM jsonb_array_elements($1)', values: ['[1,2,3]'] }
```

---

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

const result = await query<string>(db, sql`SELECT name FROM users`)
// Type inferred to string[]

const User = Record({
  id: Number,
  name: String,
})

const users = await query(db, sql`SELECT * FROM users`, User.check)
// Type inferred to [{ id: number, name: string }]
```

As an additional TypeScript helper, possu exports a `Connection` type, which can be used in your own query functions as
a generic connection parameter. It is a type alias for `pg.Pool | pg.PoolClient`.

```typescript
import { Connection, query, sql } from 'possu'

export function getUsers(conn: Connection) {
  return query(conn, sql`SELECT * FROM users`)
}
```

For actions that must be performed within a transaction, Possu also provides a `Transaction` type, which is just a
regular `pg.PoolClient` with a type-level brand. Using it is completely optional, but it may improve the readability and
type-safety of your code.

```typescript
import { Transaction, query, sql } from 'possu'

export async function insertTwoUsers(tx: Transaction) {
  await execute(tx, sql`INSERT INTO users (name) VALUES ('Alice')`)
  await execute(tx, sql`INSERT INTO users (name) VALUES ('Bob')`)
}
```

#### query

```typescript
<T>(connection: Connection, query: SqlQuery, rowParser?: (row: unknown) => T) => Promise<T[]>
```

Execute a `SELECT` or other query that returns zero or more rows. Returns all rows.

**Example:**

```typescript
const users = await query(db, sql`SELECT * FROM users`)
// => [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
```

If selecting a single column, each result row is unwrapped automatically.

```typescript
const names = await query(db, sql`SELECT name FROM users`)
// => ['Alice', 'Bob']
```

---

#### queryOne

```typescript
<T>(connection: Connection, query: SqlQuery, rowParser?: (row: unknown) => T) => Promise<T>
```

Execute a `SELECT` or other query that returns exactly one row. Returns the first row.

- Throws a `ResultError` if query doesn't return exactly one row.

**Example:**

```typescript
const user = await queryOne(db, sql`SELECT * FROM users WHERE id = 1`)
// => { id: 1, name: 'Alice' }
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryOne(db, sql`SELECT name FROM users WHERE id = 1`)
// => 'Alice'
```

You can transform the result with a custom row parser. Here we transform the
count from a string to a number by using the built-in Number constructor.

```typescript
const count = await queryOne(db, sql`SELECT count(*) FROM users`, Number)
// => 3
```

---

#### queryMaybeOne

```typescript
<T>(connection: Connection, query: SqlQuery, rowParser?: (row: unknown) => T) => Promise<T | undefined>
```

Execute a `SELECT` or other query that returns zero or one rows. Returns the first row or `undefined`.

- Throws a `ResultError` if query returns more than 1 row.

**Example:**

```typescript
const user = await queryMaybeOne(db, sql`SELECT * FROM users WHERE id = 1`)
// => { id: 1, name: 'Alice' }

const nil = await queryMaybeOne(db, sql`SELECT * FROM users WHERE false`)
// => undefined
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryMaybeOne(db, sql`SELECT name FROM users WHERE id = 1`)
// => 'Alice'
```

---

#### execute

```typescript
(connection: Connection, query: SqlQuery) => Promise<number>
```

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows. Returns the number of
rows affected.

**Example:**

```typescript
const rowCount = await execute(db, sql`INSERT INTO users (name) VALUES ('Eve')`)
// => 1
```

---

#### executeOne

```typescript
(tx: Transaction, query: SqlQuery) => Promise<number>
```

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows. Returns the number of
rows affected.

- Throws a `ResultError` if the query doesn't affect exactly one row. 
- Unlike [`execute`](#execute), it must be called within an explicit transaction, so the changes can be rolled back.

**Example:**

```typescript
await withTransaction(db, (tx) => {
  return executeOne(tx, sql`UPDATE users SET name = 'Bob' WHERE id = 1`)
})
// => 1
```

---

#### executeMaybeOne

```typescript
(tx: Transaction, query: SqlQuery) => Promise<number>
```

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows. Returns the number of
rows affected.

- Throws a `ResultError` if the query affects more than one row. 
- Unlike [`execute`](#execute), it must be called within an explicit transaction, so the changes can be rolled back.

**Example:**

```typescript
await withTransaction(db, (tx) => {
  return executeMaybeOne(tx, sql`UPDATE users SET name = 'Bob' WHERE id = 1`)
})
// => 1
```

### Transaction handling

#### withTransaction

```typescript
<T>(pool: pg.Pool, queries: (tx: Transaction) => PromiseLike<T>, options?: TransactionOptions) => Promise<T>
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

**Example:**

```typescript
const userCount = await withTransaction(db, async (tx) => {
  await execute(tx, sql`INSERT INTO users (name) VALUES ('${'Alice'}')`)
  await execute(tx, sql`INSERT INTO users (name) VALUES ('${'Bob'}')`)
  await execute(tx, sql`INSERT INTO users (name) VALUES ('${'Charlie'}')`)
  return queryOne(tx, sql`SELECT count(*) FROM users`, Number)
})
```

---

#### withSavepoint

```typescript
<T>(tx: Transaction, queries: (tx: Transaction) => PromiseLike<T>) => Promise<T>
```

Execute a set of queries within a [savepoint](https://www.postgresql.org/docs/current/sql-savepoint.html).

Start a savepoint and execute a set of queries within it. If the function
does not throw an error, the savepoint is released.

If the function throws any kind of error, the savepoint is rolled back and
the error is rethrown.

May only be used within a transaction.

**Example:**

```typescript
await withTransaction(db, async (tx) => {
  await execute(tx, sql`INSERT INTO users (name) VALUES ('Alice')`)
  return withSavepoint(tx, async (tx) => {
    await execute(tx, sql`INSERT INTO users (name) VALUES ('Bob')`)
    await execute(tx, sql`INSERT INTO users (name) VALUES ('Charlie')`)
  }).catch((err) => {
    // Let the first insert to through if the second or third one fail.
  })
})
```
