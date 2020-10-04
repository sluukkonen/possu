# Possu

A small experimental companion library for [node-postgres](https://node-postgres.com/)

## Features & Goals

- Write raw SQL easily
- Make common operations like selecting a single row or a single column easy
- Transaction handling

## TODO:

- Automatic transaction retrying
- Save points
- More query builder combinators (e.g. arrays, unnesting)

## API

- Building queries
  - [sql](#sql)
- Executing queries
  - [query](#query)
  - [many](#many)
  - [one](#one)
  - [maybeOne](#maybeOne)
  - [transaction](#transaction)

## sql

Creates an SQL query that the other functions of Possu accept. This is the only way to create queries in Possu.

```typescript
const query = sql`SELECT * FROM pet WHERE id ${id}`
```

### query

Executes a query and returns the result object. A thin wrapper around pg's `query` method.

```typescript
const result = await query(pool, sql`SELECT * FROM pet`)
const rows = result.rows // [{ id: 1, name: 'Iiris', id: 2: name: 'Jean' }]
const rowCount = result.rowCount // 2
```

### many

Executes a query and returns the result rows.

```typescript
const pets = await many(pool, sql`SELECT * FROM pet`) // [{ id: 1, name: 'Iiris', id: 2: name: 'Jean' }]
```

If selecting a single column, each result row is unwrapped automatically.

```typescript
const names = await many(pool, sql`SELECT name FROM pet`) // ['Iiris', 'Jean']
```

### one

Executes a query and returns the first row.

- Throws a `NoRowsReturnedError` if the query returned 0 rows
- Throws a `TooManyRowsReturnedError` if the query returned more than 1 row

```typescript
const pet = await one(pool, sql`SELECT * FROM pet WHERE id = 1`) // { id: 1, name: 'Iiris' }
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await one(pool, sql`SELECT name FROM pet WHERE id = 1`) // 'Iiris'
```

```typescript
const exists = await one(
  pool,
  sql`SELECT exists(SELECT 1 FROM pet WHERE name = 'Iiris')`
) // true
```

### maybeOne

Executes a query and returns the first row if it exists, `undefined` otherwise.

- Throws a `TooManyRowsReturnedError` if the query returned more than 1 row

```typescript
const pet = await maybeOne(pool, sql`SELECT * FROM pet WHERE id = 1`) // { id: 1, name: 'Iiris' }

const nothing = await maybeOne(pool, sql`SELECT * FROM pet WHERE false`) // undefined
```

If selecting a single column, it is unwrapped automatically.

```typescript
const name = await one(pool, sql`SELECT name FROM pet WHERE id = 1`) // 'Iiris'
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
