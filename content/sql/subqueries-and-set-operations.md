# Sub queries and set operations

## Overview

Nested queries and set operations let you combine, filter, and compare result sets
in SQL. A nested query is a query inside another SQL statement. A set
operation combines the rows returned by two or more independent queries.

This guide introduces scalar and correlated nested queries, compares `EXISTS` and
`IN`, and explains `UNION`, `UNION ALL`, `INTERSECT`, and `EXCEPT`.

## Nested queries

A nested query is an inner `SELECT` statement that supplies a value or a set of
rows to an outer query. You can use nested queries in expressions, predicates, and
data-manipulation statements.

### Scalar nested queries

A scalar nested query returns exactly one row and one column. You can use its
result anywhere the surrounding SQL statement accepts a single value.

The following query compares each employee's salary with the average salary:

```sql
SELECT
  e.EmployeeID,
  e.Name,
  e.Salary,
  ROUND(
    e.Salary - (SELECT AVG(Salary) FROM Employees),
    2
  ) AS SalaryDifference
FROM Employees AS e;
```

The nested query returns one value: the average salary. If a scalar nested query
returns more than one row, the database reports an error. If it returns no
rows, the result is usually `NULL`. Exact behavior can depend on the context
and database engine.

### Correlated nested queries

A correlated nested query references a column from the outer query. The nested
query uses the current outer row when it evaluates its result.

The following query returns departments with at least one employee who has a
project assignment:

```sql
SELECT
  d.DepartmentID,
  d.DepartmentName
FROM Departments AS d
WHERE EXISTS (
  SELECT 1
  FROM Employees AS e
  JOIN ProjectAssignments AS pa
    ON pa.EmployeeID = e.EmployeeID
  WHERE e.DepartmentID = d.DepartmentID
);
```

The condition `e.DepartmentID = d.DepartmentID` refers to the outer query's
`d` alias. The database evaluates the nested query in the context of each
candidate department.

### `EXISTS` and `IN`

Both `EXISTS` and `IN` can test whether a relationship exists, but they
express different conditions:

- `EXISTS` tests whether the nested query returns at least one row. The
  selected columns in the nested query don't affect the result.
- `IN` compares a value with the values returned by one column of a nested
  query.

These queries express similar logic:

```sql
-- EXISTS checks for a matching row.
SELECT d.DepartmentID
FROM Departments AS d
WHERE EXISTS (
  SELECT 1
  FROM Employees AS e
  WHERE e.DepartmentID = d.DepartmentID
);
```

```sql
-- IN compares DepartmentID with returned values.
SELECT DepartmentID
FROM Departments
WHERE DepartmentID IN (
  SELECT DepartmentID
  FROM Employees
);
```

Use `EXISTS` when you need to test for the presence of a related row,
especially when the nested query refers to the outer query. Use `IN` when a value-list
comparison makes the condition easier to understand.

`NOT IN` requires special care because a `NULL` in its list or nested query
can make the condition evaluate to `UNKNOWN`. Use `NOT EXISTS` when the
nested query can return `NULL`.

## Set operations

Set operations combine the rows returned by two or more independent `SELECT`
statements. They append or compare result sets vertically rather than joining
their columns.

### Compatibility requirements

Each query in a set operation must return the same number of columns. The
corresponding columns must have compatible data types, and the result uses the
column names from the first query.

For example:

```sql
SELECT Name, Email
FROM Employees

UNION ALL

SELECT Name, Email
FROM Contractors;
```

Both queries return two columns in the same order. The database combines
`Name` with `Name` and `Email` with `Email`.

Use explicit casts or aligned expressions when corresponding columns have
different but convertible types:

```sql
SELECT EmployeeID, Name
FROM Employees

UNION ALL

SELECT CAST(ContractorID AS INTEGER), Name
FROM Contractors;
```

Cast syntax and type-conversion rules vary by database engine.

### `UNION`

`UNION` combines the results of two or more queries and removes duplicate
rows:

```sql
SELECT Name, Email
FROM Employees

UNION

SELECT Name, Email
FROM Contractors;
```

Use `UNION` when duplicate removal is part of the required result. Removing
duplicates requires additional work, so don't use `UNION` when duplicates are
valid and meaningful.

### `UNION ALL`

`UNION ALL` appends the results of two or more queries and preserves duplicate
rows:

```sql
SELECT Name, Email
FROM Employees

UNION ALL

SELECT Name, Email
FROM Contractors;
```

Use `UNION ALL` when each source row should remain in the output or when you
know that the input sets don't overlap.

### `INTERSECT`

`INTERSECT` returns rows that appear in both query results:

```sql
SELECT Email
FROM Employees

INTERSECT

SELECT Email
FROM Contractors;
```

The result contains email addresses that occur in both tables. `INTERSECT`
usually removes duplicate rows. Check your database engine when duplicate
handling matters.

### `EXCEPT` and `MINUS`

`EXCEPT` returns rows from the first query that don't appear in the second
query:

```sql
SELECT Email
FROM Employees

EXCEPT

SELECT Email
FROM Contractors;
```

Some database engines use `MINUS` instead of `EXCEPT` for this operation. The
operator name and duplicate behavior depend on the database engine.

The SQL dialect defines the order in which set operations run. Use
parentheses when combining multiple operators and the intended order isn't
obvious:

```sql
(
  SELECT Name, Email
  FROM Employees
  WHERE DepartmentID = 10
)

UNION ALL

(
  SELECT Name, Email
  FROM Contractors
  WHERE Skill = 'Engineering'
)

EXCEPT

SELECT Name, Email
FROM RestrictedContractors;
```

The syntax for parenthesized set operations varies by database engine. Check
the engine documentation when combining more than two set operators.

## Complete example

The following examples use `Employees`, `Contractors`, `Departments`,
`ProjectAssignments`, and `RestrictedContractors`.

### Compare salaries with an aggregate

```sql
SELECT
  e.EmployeeID,
  e.Name,
  e.Salary,
  ROUND(
    e.Salary - (SELECT AVG(Salary) FROM Employees),
    2
  ) AS SalaryDifference
FROM Employees AS e;
```

The scalar nested query returns the company-wide average salary.

### Find departments with assignments

```sql
SELECT
  d.DepartmentID,
  d.DepartmentName
FROM Departments AS d
WHERE EXISTS (
  SELECT 1
  FROM Employees AS e
  JOIN ProjectAssignments AS pa
    ON pa.EmployeeID = e.EmployeeID
  WHERE e.DepartmentID = d.DepartmentID
);
```

The correlated nested query checks each department for at least one matching
employee assignment.

### Combine staff and contractors

The following query combines internal engineering staff with external
engineering contractors, then excludes contractors in a restricted registry:

```sql
(
  SELECT Name, Email, 'Full-Time' AS RoleType
  FROM Employees
  WHERE DepartmentID = 10
)

UNION ALL

(
  SELECT Name, Email, 'Contractor' AS RoleType
  FROM Contractors
  WHERE Skill = 'Engineering'
)

EXCEPT

SELECT Name, Email, 'Contractor' AS RoleType
FROM RestrictedContractors;
```

The three queries return the same number of columns in the same order. The
literal `RoleType` values also make the source of each row explicit.

## Common pitfalls

### `NULL` values with `NOT IN`

This condition can return no rows when the nested query returns a `NULL`:

```sql
WHERE DepartmentID NOT IN (
  SELECT DepartmentID
  FROM ExcludedDepartments
)
```

For a non-matching department, the comparison with `NULL` evaluates to
`UNKNOWN`. `NOT UNKNOWN` remains `UNKNOWN`, and a `WHERE` clause excludes
that result.

Use `NOT EXISTS`:

```sql
WHERE NOT EXISTS (
  SELECT 1
  FROM ExcludedDepartments AS excluded
  WHERE excluded.DepartmentID = Departments.DepartmentID
)
```

If you use `NOT IN`, filter out `NULL` values explicitly:

```sql
WHERE DepartmentID NOT IN (
  SELECT DepartmentID
  FROM ExcludedDepartments
  WHERE DepartmentID IS NOT NULL
)
```

### Unnecessary duplicate removal

`UNION` removes duplicates, which can require sorting or another duplicate
removal step. When duplicate rows are valid, use `UNION ALL` to preserve them
and avoid unnecessary work.

Don't replace `UNION ALL` with `UNION` without confirming that duplicate rows
should disappear. Duplicate removal can also change counts used by later
queries.

### Scalar nested queries that return multiple rows

A scalar nested query must return one row and one column. This query can fail if
several employees have the same department:

```sql
SELECT
  DepartmentID,
  (
    SELECT EmployeeID
    FROM Employees
    WHERE Employees.DepartmentID = Departments.DepartmentID
  ) AS EmployeeID
FROM Departments;
```

If you need multiple related rows, use a join, an aggregate, or an `EXISTS`
predicate instead of a scalar nested query.

### Correlated nested query performance

A correlated nested query depends on an outer row, so it can require repeated work
as the database processes the outer query. The actual plan depends on the
database engine, indexes, and optimizer.

For large data sets, compare a correlated nested query with an equivalent join or
pre-aggregated query. Index the columns used to correlate the queries, and
inspect the execution plan before changing the query.

### Positional column mismatches

Set operations match columns by position, not by name. This query combines
unrelated values because the column order differs:

```sql
-- Avoid this pattern.
SELECT Name, Email
FROM Employees

UNION ALL

SELECT Email, Name
FROM Contractors;
```

Align the columns explicitly:

```sql
SELECT Name, Email
FROM Employees

UNION ALL

SELECT Name, Email
FROM Contractors;
```

Use the same order, compatible types, and compatible meanings in every query
that participates in a set operation.

## Key takeaways

- A scalar nested query returns one row and one column.
- A correlated nested query references the outer query.
- Use `EXISTS` to test whether a nested query returns a row.
- Use `IN` to compare a value with a list returned by a nested query.
- Use `UNION` to remove duplicates and `UNION ALL` to preserve them.
- Use `INTERSECT` for rows present in both results.
- Use `EXCEPT` or the dialect-specific `MINUS` for rows present only in the
  first result.
- Keep column counts, positions, types, and meanings compatible across set
  operations.
