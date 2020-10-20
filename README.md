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

// Each possu query function accepts a connection pool and a query created with
// the `sql` tagged template string as an argument.
const name = await queryOne(pool, sql`SELECT name FROM pet WHERE id = ${id}`)

// Instead of a pool, a client checked out from a pool is also accepted.
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
  // transaction is scoped to. The client is released back to the pool after the
  // transaction ends.
  await execute(tx, sql`INSERT INTO pet (name) VALUES(${'Napoleon'})`)
  // Here we're using a custom row parser to convert the count from a string to
  // a number.
  return queryOne(tx, sql`SELECT count(*) FROM pet`, Number)
})
```

## API

- [Building queries](#building-queries)
  - [sql](#sql)
  - [sql.identifier](#sql.identifier)
  - [sql.json](#sql.json)
- [Executing queries](#executing-queries)
  - [query](#query)
  - [queryOne](#queryOne)
  - [queryMaybeOne](#queryMaybeOne)
  - [execute](#execute)
- [Transaction handling](#transaction-handling)
  - [withTransaction](#withTransaction)
  - [withTransactionLevel](#withTransactionLevel)
  - [withTransactionMode](#withTransactionMode)

### Building queries

#### sql

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

#### sql.identifier

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

Serialize a value as JSON to be used in a query.

```typescript
sql`SELECT * FROM jsonb_array_elements(${sql.json([1, 2, 3])})`
// => { text : 'SELECT * FROM jsonb_array_elements($1)', values: ['[1,2,3]'] }
```

### Executing queries

Each of the query functions take a connection pool or a client checked out of
the pool as the first argument.

For queries that return result rows, you may also supply an optional row
parser, which validates and optionally transforms the value of each row. This
can be useful when combined with a library like
[io-ts](https://github.com/gcanti/io-ts) or
[runtypes](https://github.com/pelotom/runtypes).

When using TypeScript, the type of each result row is `unknown` by default,
so you must either cast the result to the correct type or to use a row 
parser that helps the TypeScript compiler infer the correct result type.

```typescript
import { Record, Number, String } from 'runtypes'

const result = await query<string>(pool, sql`SELECT name FROM pet`)
// Type inferred to string[]

const Pet = Record({
  id: Number,
  name: String,
})

const pets = await query(client, sql`SELECT * FROM pet`, Pet.check)
// Type inferred to [{ id: number, name: string }]
```

#### query

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  query<T>(client: Pool | PoolClient, query: SqlQuery, rowParser?: (row: unknown) => T): Promise<T[]>
  ```
</details>

Execute a `SELECT` or other query that returns zero or more rows.

Returns all rows.

```typescript
const pets = await query<Pet>(pool, sql`SELECT * FROM pet`)
// => [{ id: 1, name: 'Iiris', id: 2: name: 'Jean' }]
```

If selecting a single column, each result row is unwrapped automatically.

```typescript
const names = await query<string>(client, sql`SELECT name FROM pet`)
// => ['Iiris', 'Jean']
```

#### queryOne

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  queryOne<T>(client: Pool | PoolClient, query: SqlQuery, rowParser?: (row: unknown) => T): Promise<T>
  ```
</details>


Execute a `SELECT` or other query that returns exactly one row.

Returns the first row.

- Throws a `ResultError` if query doesn't return exactly one row.

```typescript
const pet = await queryOne<Pet>(pool, sql`SELECT id, name FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryOne<string>(client, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

You can transform the result with a custom row parser. Here we transform the
count from a string to a number by using the built-in Number constructor.
With it, we may also drop the explicit cast.

```typescript
const count = await queryOne(client, sql`SELECT count(*) FROM pet`, Number)
// => 3
```

#### queryMaybeOne

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  queryMaybeOne<T>(client: Pool | PoolClient, query: SqlQuery, rowParser?: (row: unknown) => T): Promise<T | undefined>
  ```
</details>

Execute a `SELECT` or other query that returns zero or one rows.

Returns the first row or `undefined`.

- Throws a `ResultError` if query returns more than 1 row.

```typescript
const pet = await queryMaybeOne<Pet>(pool, sql`SELECT id, name FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }

const nothing = await queryMaybeOne<Pet>(client, sql`SELECT id, name FROM pet WHERE false`) 
// => undefined
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryMaybeOne<string>(pool, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

#### execute

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  execute(client: Pool | PoolClient, query: SqlQuery): Promise<number>
  ```
</details>

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows.

Returns the number of rows affected.

```typescript
const rowCount = await execute(pool, sql`INSERT INTO pet (name) VALUES ('Fae')`)
// => 1
```

### Transaction handling

#### withTransaction

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  withTransaction<T>(client: Pool | PoolClient,
                     queries: (tx: PoolClient) => PromiseLike<T>): Promise<T>
  ```
</details>

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

#### withTransactionLevel

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  withTransactionLevel<T>(isolationLevel: IsolationLevel,
                          client: Pool | PoolClient,
                          queries: (tx: PoolClient) => PromiseLike<T>): Promise<T>
  ```
</details>

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
    const count = await queryOne(tx, sql`SELECT count(*) FROM pet`, Number)
    if (count > 5) {
      throw new Error('You have too many pets already!')
    }
    return count
  }
)
```

#### withTransactionMode

<details>
  <summary>Show type signature</summary>
  
  ```typescript
  withTransactionMode<T>(transactionMode: TransactionMode,
                         client: Pool | PoolClient,
                         queries: (tx: PoolClient) => PromiseLike<T>): Promise<T>
  ```
</details>

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
    const count = await queryOne(tx, sql`SELECT count(*) FROM pet`, Number)
    if (count > 5) {
      throw new Error('You have too many pets already!')
    }
    return count
  }
)
```
