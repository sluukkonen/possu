# Possu 🐖

![CI](https://github.com/sluukkonen/possu/workflows/CI/badge.svg)
![Dependencies](https://img.shields.io/david/sluukkonen/possu)
![NPM](https://img.shields.io/npm/v/possu)

A small companion library for [node-postgres](https://node-postgres.com/).

## Features & Goals

- A Promise-based API, which aims to reduce common boilerplate
- Write raw SQL queries with tagged template strings
- Supports nested queries
- Transaction handling
- First-class TypeScript support
- Not a framework. We let [node-postgres](https://node-postgres.com) handle the
  nitty-gritty bits like connection pooling, so you can integrate Possu easily to
  an existing application.

## TODO

- More query builder features (e.g. arrays, unnesting)
- Savepoints
- Automatic transaction retrying (perhaps)

## Getting started

```
$ npm install possu
```

```typescript
import { execute, queryOne, sql, withTransaction } from 'possu'
import { Pool } from 'pg'

// To start off, you'll need a connection pool from `pg`.
const pool = new Pool({ ... })

// Each possu query function accepts a connection pool as an argument.
const name = await queryOne(pool, sql`SELECT name FROM pet WHERE id = ${id}`)

// A client checked out from a pool is also accepted.
const client = await pool.connect()
try {
  const count = await queryOne(client, sql`SELECT count(*) FROM pet`)
} finally {
  client.release()
}

// Usually it is best to work in terms of a pool, so you don't have to check out
// and release the client yourself. However, when working with transactions,
// using client is necessary. Thankfully, Possu includes functions that do the
// heavy lifting for you.
const newCount = await withTransaction(pool, async (tx) => {
  // Here `tx` is a client checked out from the pool that the current
  // transaction is scoped to.
  await execute(tx, sql`INSERT INTO pet (name) VALUES(${'Napoleon'})`)
  return queryOne(tx, sql`SELECT count(*) FROM pet`)
})
```

## API

- Building queries
  - [sql](#sql)
  - [sql.identifier](#sql.identifier)
  - [sql.json](#sql.json)
- Executing queries
  - [query](#query)
  - [queryOne](#queryOne)
  - [queryMaybeOne](#queryMaybeOne)
  - [execute](#execute)
- Transaction handling
  - [withTransaction](#withTransaction)
  - [withTransactionLevel](#withTransactionLevel)
  - [withTransactionMode](#withTransactionMode)

### sql

Create an SQL query.

This is the only way to create queries in Possu. Other Possu functions check
at runtime that the query has been created with `sql`.

```typescript
const query = sql`SELECT * FROM pet WHERE id = ${1}`
// => { text: 'SELECT * FROM pet WHERE id = $1', values: [1] }
```

Queries may also be nested. This is a powerful mechanism for code reuse.

```typescript
const query = sql`SELECT * FROM pet WHERE id = ${1}`
const exists = sql`SELECT exists(${query})`
// => { text: 'SELECT exists(SELECT * FROM pet WHERE id = $1)', values: [1] }
```

### sql.identifier

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

### sql.json

Serialize a value as JSON to be used in a query.

```typescript
sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
// => { text : 'SELECT * FROM jsonb_array_elements($1)', values: ['[1,2,3]'] }
```

### query

Execute a `SELECT` or other query that returns zero or more rows.

Returns all rows.

```typescript
const pets = await query(pool, sql`SELECT * FROM pet`)
// => [{ id: 1, name: 'Iiris', id: 2: name: 'Jean' }]
```

If selecting a single column, each result row is unwrapped automatically.

```typescript
const names = await query(client, sql`SELECT name FROM pet`)
// => ['Iiris', 'Jean']
```

You may also supply an optional row parser, which validates and transforms the
value of each row. This can be useful when combined with a library like
[io-ts](https://github.com/gcanti/io-ts) or
[runtypes](https://github.com/pelotom/runtypes).

```typescript
import { Record, Number, String } from 'runtypes'

const Pet = Record({
  id: Number,
  name: String,
})

const pets = await query(client, sql`SELECT * FROM pet`, Pet.check) // Type inferred to [{ id: number, name: string }]
```

### queryOne

Execute a `SELECT` or other query that returns exactly one row.

Returns the first row.

- Throws a `ResultError` if query doesn't return exactly one row.

```typescript
const pet = await queryOne(pool, sql`SELECT * FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryOne(client, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

You may also supply an optional row parser, which validates and transforms the
value of each row. This can be useful when combined with a library like
[io-ts](https://github.com/gcanti/io-ts) or
[runtypes](https://github.com/pelotom/runtypes).

```typescript
import { Record, Number, String } from 'runtypes'

const Pet = Record({
  id: Number,
  name: String,
})

const pet = await queryOne(
  client,
  sql`SELECT * FROM pet WHERE id = 1`,
  Pet.check
) // Type inferred to { id: number, name: string }
```

### queryMaybeOne

Execute a `SELECT` or other query that returns zero or one rows.

Returns the first row or `undefined`.

- Throws a `ResultError` if query returns more than 1 row.

```typescript
const pet = await queryMaybeOne(pool, sql`SELECT * FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }

const nothing = await queryMaybeOne(client, sql`SELECT * FROM pet WHERE false`)
// => undefined
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryMaybeOne(pool, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

You may also supply an optional row parser, which validates and transforms
the value of each row. This can be useful when combined with a library like
[io-ts](https://github.com/gcanti/io-ts) or
[runtypes](https://github.com/pelotom/runtypes).

```typescript
import { Record, Number, String } from 'runtypes'

const Pet = Record({
  id: Number,
  name: String,
})

const pet = await queryMaybeOne(
  client,
  sql`SELECT * FROM pet WHERE id = 1`,
  Pet.check
) // Type inferred to { id: number, name: string } | undefined
```

### execute

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows.

Returns the number of rows affected.

```typescript
const name = await execute(pool, sql`INSERT INTO pet (name) VALUES ('Fae')`)
// => 1
```

### withTransaction

Execute a set of queries within a transaction.

Start a transaction and execute a set of queries within it. If the function
does not throw an error, the transaction is committed. Returns the value
returned from the function.

If the function throws any kind of error, the transaction is rolled back and
the error is rethrown.

```typescript
const petCount = await withTransaction(pool, async (tx) => {
  await execute(tx, sql`INSERT INTO pet (name) VALUES ('Senna')`)
  const count = await queryOne(tx, sql`SELECT count(*) FROM pet`, Number)
  if (count > 5) {
    throw new Error('You have too many pets already!')
  }
  return count
})
```

### withTransactionLevel

Execute a set of queries within a transaction, using the given [isolation
level](https://www.postgresql.org/docs/current/transaction-iso.html).

The isolation level may be either:

- `IsolationLevel.Default`
- `IsolationLevel.Serializable`
- `IsolationLevel.RepeatableRead`
- `IsolationLevel.ReadCommitted`

```typescript
const petCount = await withTransactionLevel(
  IsolationLevel.Serializable,
  pool,
  async (tx) => {
    await execute(tx, sql`INSERT INTO pet (name) VALUES ('Senna')`)
    const count = await queryOne(tx, sql`SELECT count(*) FROM pet`)
    if (count > 5) {
      throw new Error('You have too many pets already!')
    }
    return count
  }
)
```

### withTransactionMode

Execute a set of queries within a transaction, using the given [isolation
level](https://www.postgresql.org/docs/current/transaction-iso.html) and
[access
mode](https://www.postgresql.org/docs/current/sql-set-transaction.html).

The isolation level may be either:

- `IsolationLevel.Default`
- `IsolationLevel.Serializable`
- `IsolationLevel.RepeatableRead`
- `IsolationLevel.ReadCommitted`

The access mode may be either:

- `AccessMode.Default`
- `AccessMode.ReadWrite`
- `AccessMode.ReadOnly`

```typescript
const petCount = await withTransactionMode(
  {
    isolationLevel: IsolationLevel.Serializable,
    accessMode: AccessMode.ReadWrite,
  },
  pool,
  async (tx) => {
    await execute(tx, sql`INSERT INTO pet (name) VALUES ('Senna')`)
    const count = await queryOne(tx, sql`SELECT count(*) FROM pet`)
    if (count > 5) {
      throw new Error('You have too many pets already!')
    }
    return count
  }
)
```
