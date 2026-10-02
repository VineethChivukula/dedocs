# Basic querying and filtering

## Overview

Basic SQL querying and filtering statements retrieve data from relational
database management systems. Use `SELECT` to choose the data to
return and filtering clauses and operators to limit the rows in the result.

This guide introduces the core syntax for querying and filtering data. It
assumes that you understand tables, columns, and basic SQL data types.

## Core concepts

### `SELECT`

The `SELECT` statement specifies the columns or expressions that a query
returns. It defines the columns in the result set.

You can select specific columns:

```sql
SELECT ename, sal
FROM employees;
```

Use `*` to select every column:

```sql
SELECT *
FROM employees;
```

`SELECT` can also evaluate expressions, convert values to an explicit data
type, and return literal values. Select only the columns that you need when
possible. This makes the result easier to read and can reduce the amount of
data that the database returns.

### `WHERE`

The `WHERE` clause filters rows based on a condition. The database evaluates
the condition for each candidate row.

SQL uses three-valued logic. A condition evaluates to `TRUE`, `FALSE`, or
`UNKNOWN`. The query keeps only rows for which the `WHERE` condition evaluates
to `TRUE`. The database excludes rows that evaluate to `FALSE` or `UNKNOWN`.

For example, this query returns employees whose salary is at least 30,000:

```sql
SELECT EmployeeID, Name, Salary
FROM Employees
WHERE Salary >= 30000;
```

### Logical operators

Use `AND`, `OR`, and `NOT` to combine or invert conditions.

- `AND` returns `TRUE` only when both conditions are `TRUE`.
- `OR` returns `TRUE` when at least one condition is `TRUE`.
- `NOT` reverses the result of a condition. `TRUE` becomes `FALSE`, and
  `FALSE` becomes `TRUE`.

`AND` has higher precedence than `OR`. For example, SQL evaluates
`A OR B AND C` as `A OR (B AND C)`. Use parentheses to make the intended
evaluation order explicit:

```sql
WHERE (DepartmentID = 10 OR DepartmentID = 20)
  AND Salary <= 85000
```

Parentheses make complex predicates easier to review and prevent changes to
the condition from producing unintended results.

### `BETWEEN`

The `BETWEEN` operator matches values in an inclusive range:

```sql
WHERE Salary BETWEEN 30000 AND 85000
```

This condition is equivalent to:

```sql
WHERE Salary >= 30000 AND Salary <= 85000
```

The range includes both boundary values. `BETWEEN` works with values that have an
ordering, including numbers, dates, and timestamps. Take care when using it
with timestamps. See [Timestamp boundaries](#timestamp-boundaries) below.

### `IN`

The `IN` operator matches a value against a list of values:

```sql
WHERE DepartmentID IN (10, 20, 30)
```

This condition is equivalent to:

```sql
WHERE DepartmentID = 10
   OR DepartmentID = 20
   OR DepartmentID = 30
```

`IN` can also compare a value with the result of a nested query:

```sql
WHERE origin IN (
  SELECT dest
  FROM flights
)
```

Use `IN` for a discrete set of allowed values. Use `BETWEEN` when the
condition describes a continuous range.

### `LIKE` pattern matching

The `LIKE` operator compares a string with a pattern. Its wildcard characters
have these meanings:

- `%` matches zero or more characters. For example, `LIKE 'A%'` matches
  strings that start with `A`, and `LIKE '%ER'` matches strings that end with
  `ER`.
- `_` matches exactly one character. For example, `LIKE '_A%'` matches
  strings whose second character is `A`.

For example:

```sql
WHERE JobTitle LIKE '%ENGINEER%'
```

This condition matches job titles that contain `ENGINEER`. The matching rules
for letter case depend on the database engine and collation settings.

## Complete example

Suppose that an `Employees` table contains the following columns:
`EmployeeID`, `Name`, `JobTitle`, `DepartmentID`, `Salary`, and `HireDate`.

The following query returns employees in selected departments whose salaries
fall within a specified range and whose job titles match one of two patterns.
It excludes test accounts:

```sql
SELECT
  EmployeeID,
  Name,
  JobTitle,
  DepartmentID,
  Salary
FROM Employees
WHERE DepartmentID IN (10, 20, 30)
  AND Salary BETWEEN 30000 AND 85000
  AND (
    JobTitle LIKE '%ENGINEER%'
    OR JobTitle LIKE 'ANALYST%'
  )
  AND NOT (Name LIKE 'TEST_%');
```

The parentheses around the `JobTitle` conditions ensure that SQL evaluates the
`OR` expression as one group before `AND` combines it with the other
conditions.

## Common pitfalls

### `NULL` values with `NOT IN`

`NOT IN` can produce unexpected results when its list or nested query contains
`NULL`. For example:

```sql
WHERE DepartmentID NOT IN (10, 20, NULL)
```

SQL expands this condition to a series of comparisons joined with `OR`.
Because every comparison with `NULL` evaluates to `UNKNOWN`, the complete
condition can evaluate to `UNKNOWN` for every row. A `WHERE` clause excludes
`UNKNOWN`, so the query can return no rows.

When you use a nested query, filter out `NULL` values:

```sql
WHERE DepartmentID NOT IN (
  SELECT DepartmentID
  FROM ExcludedDepartments
  WHERE DepartmentID IS NOT NULL
)
```

You can also use `NOT EXISTS`, which avoids this `NULL` behavior:

```sql
WHERE NOT EXISTS (
  SELECT 1
  FROM ExcludedDepartments AS excluded
  WHERE excluded.DepartmentID = Employees.DepartmentID
)
```

### Logical precedence

Without parentheses, this condition:

```sql
WHERE DepartmentID = 10
   OR DepartmentID = 20
  AND Salary <= 2000
```

SQL evaluates it as:

```sql
WHERE DepartmentID = 10
   OR (DepartmentID = 20 AND Salary <= 2000)
```

As a result, the query returns every employee in department 10, regardless of
salary, and only employees with salaries of 2,000 or less in department 20.
If you intend to apply the salary condition to both departments, group the
department conditions:

```sql
WHERE (DepartmentID = 10 OR DepartmentID = 20)
  AND Salary <= 2000
```

### Leading wildcards

A pattern that starts with `%`, such as `LIKE '%ENGINEER'`, usually prevents
the database from using a standard B-tree index to find matching text
efficiently. The database might need to scan many or all rows instead.

On large tables, use an index or search feature designed for partial-string
matching when your database engine provides one. The available options depend
on the database engine and its configuration.

### Case sensitivity

The case sensitivity of `LIKE` depends on the database engine and collation
settings. A search for `UNIX` might not match `Unix` or `unix`.

When you need case-insensitive matching, normalize the values explicitly:

```sql
WHERE LOWER(Name) LIKE '%unix%'
```

You can also use a case-insensitive comparison feature provided by your
database engine. Check the engine documentation before relying on
dialect-specific syntax.

### Timestamp boundaries

Using `BETWEEN` with date-only values can exclude records later on the end
date. For example:

```sql
WHERE HireDate BETWEEN '2023-01-01' AND '2023-01-31'
```

Depending on the database engine, the engine can interpret the end value as
`2023-01-31 00:00:00`. The query then excludes records created later on
January 31.

For a half-open date range, include the start timestamp, and exclude the first
instant of the following period:

```sql
WHERE HireDate >= '2023-01-01'
  AND HireDate < '2023-02-01'
```

This pattern includes every timestamp from the start of January 1 through
the end of January 31, regardless of the time precision supported by the
database.

## Key takeaways

- Use `SELECT` to specify the columns and expressions in a result set.
- Use `WHERE` to keep only rows that match a condition.
- Use parentheses when combining `AND` and `OR`.
- Use `BETWEEN` for inclusive ranges and `IN` for discrete value lists.
- Use `%` and `_` to define `LIKE` patterns.
- Handle `NULL` explicitly, especially when using `NOT IN`.
- Use half-open ranges when filtering timestamp columns by date.
