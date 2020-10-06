# Possu 🐖

![CI](https://github.com/sluukkonen/possu/workflows/CI/badge.svg)

A small companion library for [node-postgres](https://node-postgres.com/).

## Features & Goals

- A Promise-based API which aims to make common operations easy
- Write raw SQL easily & safely with tagged template strings
- Supports nested queries
- Transaction handling

## TODO:

- More query builder features (e.g. nested queries, arrays, unnesting)
- Customization of transaction modes
- Savepoints
- Automatic transaction retrying (perhaps)

## API

- Building queries
  - [sql](#sql)
- Executing queries
  - [query](#query)
  - [queryOne](#queryOne)
  - [queryMaybeOne](#queryMaybeOne)
  - [execute](#execute)
- Transactions
  - [transaction](#transaction)

## sql

Create an SQL query.

This is the only way to create queries in Possu. Other Possu functions check
that the query has been created with `sql`.

```typescript
const query = sql`SELECT * FROM pet WHERE id = ${1}`
// => { text: 'SELECT * FROM pet WHERE id = $1', values: [1] }
```

Queries may also be nested. This is a powerful mechanism for code reuse.

```typescript
const iiris = sql`SELECT * FROM pet WHERE name = ${'Iiris'}`
const exists = sql`SELECT exists(${iiris})`
// => { text: 'SELECT exists(SELECT * FROM pet WHERE name = $1)', values: ['Iiris'] }
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
const names = await query(pool, sql`SELECT name FROM pet`)
// => ['Iiris', 'Jean']
```

### queryOne

Execute a `SELECT` or other query that returns exactly one row.

Returns the first row.

- Throws a `NoRowsReturnedError` if query returns no rows.
- Throws a `TooManyRowsReturnedError` if query returns more than 1 row.

```typescript
const pet = await queryOne(pool, sql`SELECT * FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryOne(pool, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

### queryMaybeOne

Execute a `SELECT` or other query that returns zero or one rows.

Returns the first row or `undefined`.

- Throws a `TooManyRowsReturnedError` if query returns more than 1 row.

```typescript
const pet = await queryMaybeOne(pool, sql`SELECT * FROM pet WHERE id = 1`)
// => { id: 1, name: 'Iiris' }

const nothing = await queryMaybeOne(pool, sql`SELECT * FROM pet WHERE false`)
// => undefined
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await queryMaybeOne(pool, sql`SELECT name FROM pet WHERE id = 1`)
// => 'Iiris'
```

### execute

Execute an `INSERT`, `UPDATE`, `DELETE` or other query that is not expected to return any rows.

Returns the number of rows affected.

```typescript
const name = await execute(pool, sql`INSERT INTO pet (name) VALUES ('Fae')`)
// => 1
```

### transaction

Execute a function within a transaction.

Start a transaction and execute a set of queries within it. If the function
returns a resolved promise, the transaction is committed. Returns the value
returned from the function.

If the function returns a rejected Promise or throws any kind of error, the
transaction is rolled back and the error is rethrown.

```typescript
const petCount = await transaction(pool, async (tx) => {
  await execute(tx, sql`INSERT INTO pet (name) VALUES ('Senna')`)
  const count = await queryOne(tx, sql`SELECT count(*) FROM pet`)
  if (count > 5) {
    throw new Error('You have too many pets already!')
  }
  return count
})
```

## Error handling

All errors thrown by possu are subclasses of `PossuError`, so you can detect them with `instanceof`.
