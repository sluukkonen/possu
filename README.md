# Possu

A small companion library for [node-postgres](https://node-postgres.com/)

## Goals

- Write raw SQL easily & safely
- Make common operations like selecting a single row easy
- Transaction handling

## TODO:

- More query builder features (e.g. nested queries, arrays, json, unnesting)
- Customization of transaction isolation levels
- Savepoints
- Automatic transaction retrying (if feasible)

## APIis

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

Creates an SQL query that the other functions of Possu accept.

This is the only way to create queries in Possu. Other possu functions check
that the query has been created with `sql`.

```typescript
const query = sql`SELECT * FROM pet WHERE id = ${1}`
// => { text: 'SELECT * FROM pet WHERE id = $1', values: [1] }
```

### query

Execute a `SELECT` or other query that returns zero or more result rows.

Returns all result rows.

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

Execute a `SELECT` or other query that returns zero or one result rows.

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
