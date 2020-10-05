# Possu

A small experimental companion library for [node-postgres](https://node-postgres.com/)

## Features & Goals

- Write raw SQL easily
- Make common operations like selecting a single row or a single column easy
- Transaction handling

## TODO:

- More query builder features (e.g. nested queries, arrays, json, unnesting)
- Customization of transaction isolation levels
- Savepoints
- Automatic transaction retrying (if feasible)

## API

- Building queries
  - [sql](#sql)
- Executing queries
  - [query](#query)
  - [queryOne](#queryOne)
  - [queryMaybeOne](#queryMaybeOne)
  - [execute](#execute)
  - [transaction](#transaction)

## sql

Creates an SQL query that the other functions of Possu accept. This is the only way to create queries in Possu.

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

Starts a transaction and executes a set of queries within in. The transaction will be rolled back if an exception is thrown.

```typescript
const petCount = await transaction(pool, async (tx) => {
  await query(tx, sql`INSERT INTO pet (name) VALUES ('Senna')`)
  const count = await one(tx, sql`SELECT count(*) FROM pet`)
  if (count > 5) {
    throw new Error('You have too many pets already!')
  }
  return count
})
```
