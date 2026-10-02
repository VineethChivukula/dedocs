# Conditional logic and null handling

## Overview

SQL uses conditional expressions to choose values, classify rows, and handle
missing information. Understanding SQL three-valued logic and `NULL` is
essential because comparisons with `NULL` don't behave like comparisons with
ordinary values.

This guide explains three-valued logic, `CASE`, `COALESCE`, and `NULLIF`. It
also describes common pitfalls that can change query results or cause runtime
errors.

## Three-valued logic

Boolean logic normally has two possible values: `TRUE` and `FALSE`. SQL adds a
third value, `UNKNOWN`, to represent the result of operations involving
missing information. A `NULL` value represents the absence of a value. It
doesn't represent zero, an empty string, or a specific unknown value.

### Comparing values with `NULL`

Standard comparison operators don't determine that a value is equal or
unequal to `NULL`. Comparisons such as these evaluate to `UNKNOWN`:

```sql
Salary = NULL
Salary <> NULL
NULL = NULL
```

Use `IS NULL` or `IS NOT NULL` to test for missing values:

```sql
WHERE Commission IS NULL
```

```sql
WHERE Commission IS NOT NULL
```

A `WHERE` clause keeps only rows for which its condition evaluates to `TRUE`.
It excludes rows for which the condition evaluates to `FALSE` or `UNKNOWN`.

### Logical operators

When a query combines conditions with `AND`, `OR`, or `NOT`, `UNKNOWN` follows
these rules:

| Expression | Result | Reason |
| --- | --- | --- |
| `TRUE AND UNKNOWN` | `UNKNOWN` | The unknown condition might be true or false. |
| `FALSE AND UNKNOWN` | `FALSE` | One false condition makes the result false. |
| `TRUE OR UNKNOWN` | `TRUE` | One true condition makes the result true. |
| `FALSE OR UNKNOWN` | `UNKNOWN` | The unknown condition might be true or false. |
| `NOT UNKNOWN` | `UNKNOWN` | Inverting an unknown result remains unknown. |

For example, this query excludes rows where `Commission` is `NULL` because
the comparison produces `UNKNOWN`:

```sql
SELECT EmployeeID, Name
FROM EmployeeSales
WHERE Commission > 1000;
```

If you want missing commissions to behave as zero, state that rule explicitly:

```sql
SELECT EmployeeID, Name
FROM EmployeeSales
WHERE COALESCE(Commission, 0) > 1000;
```

## `CASE` expressions

The `CASE` expression provides conditional branching in a query. You can use
it in `SELECT`, `WHERE`, `ORDER BY`, and `GROUP BY` clauses.

### Searched `CASE` syntax

Use this form to evaluate one or more Boolean conditions:

```sql
CASE
  WHEN condition1 THEN result1
  WHEN condition2 THEN result2
  ELSE default_result
END
```

SQL evaluates the `WHEN` conditions in order and returns the result from the
first condition that evaluates to `TRUE`. A condition that evaluates to
`UNKNOWN` doesn't match.

The `ELSE` clause is optional. If no `WHEN` condition evaluates to `TRUE` and
the expression has no `ELSE` clause, `CASE` returns `NULL`.

For example:

```sql
CASE
  WHEN Salary >= 80000 THEN 'Tier 1'
  WHEN Salary >= 50000 THEN 'Tier 2'
  ELSE 'Tier 3'
END
```

Put more specific conditions before broader conditions. In the example,
employees with salaries of at least 80,000 must match the first condition
before they can match the condition for salaries of at least 50,000.

## `COALESCE`

`COALESCE` returns the first non-`NULL` expression in its argument list:

```sql
COALESCE(expression1, expression2, expression3)
```

SQL evaluates the expressions from left to right. If every expression is
`NULL`, `COALESCE` returns `NULL`.

Use `COALESCE` when you need a fallback value:

```sql
SELECT
  Name,
  COALESCE(Commission, 0) AS Commission
FROM EmployeeSales;
```

You can also use it in calculations:

```sql
SELECT
  BaseSalary + COALESCE(Commission, 0) AS TotalEarnings
FROM EmployeeSales;
```

Choose a fallback value that matches the meaning of the data. Converting a
missing commission to zero is appropriate only when a missing commission
means that no commission applies.

## `NULLIF`

`NULLIF(expression1, expression2)` compares two expressions:

- If the expressions are equal, `NULLIF` returns `NULL`.
- If they aren't equal, `NULLIF` returns `expression1`.

For example:

```sql
NULLIF(UnitsSold, 0)
```

returns `NULL` when `UnitsSold` is zero. This makes it useful for protecting a
division from a zero denominator:

```sql
SELECT
  Revenue / NULLIF(UnitsSold, 0) AS RevenuePerUnit
FROM Sales;
```

When `UnitsSold` is zero, the expression returns `NULL` instead of attempting
to divide by zero. Decide separately whether the app should display
that `NULL` as a message or fallback value.

## Complete example

Suppose that an `EmployeeSales` table contains `EmployeeID`, `Name`,
`BaseSalary`, `Commission`, `ActualSales`, and `TargetSales`. The following
query calculates earnings, assigns compensation tiers, calculates target
achievement, and assigns a sales status:

```sql
SELECT
  EmployeeID,
  Name,
  BaseSalary + COALESCE(Commission, 0) AS TotalEarnings,
  CASE
    WHEN BaseSalary + COALESCE(Commission, 0) >= 80000 THEN 'Tier 1'
    WHEN BaseSalary + COALESCE(Commission, 0) >= 50000 THEN 'Tier 2'
    ELSE 'Tier 3'
  END AS CompensationTier,
  ROUND(
    (ActualSales / NULLIF(TargetSales, 0)) * 100,
    2
  ) AS TargetAchievementPct,
  CASE
    WHEN TargetSales IS NULL OR TargetSales = 0 THEN 'No Target Set'
    WHEN ActualSales >= TargetSales THEN 'Goal Achieved'
    ELSE 'Goal Missed'
  END AS SalesStatus
FROM EmployeeSales
WHERE COALESCE(Commission, 0) < 5000;
```

This query uses each feature for a different purpose:

- `COALESCE` treats a missing commission as zero for the earnings calculation
  and filter.
- `CASE` assigns a compensation tier and a sales status.
- `NULLIF` converts a zero target to `NULL` before division.
- `IS NULL` explicitly checks for employees without a target.

The exact return type of division and `ROUND` behavior can vary by database
engine. Check your engine's documentation when numeric precision matters.

## Common pitfalls

### `NULL` values with `NOT IN`

`NOT IN` can produce no rows when its list or nested query contains `NULL`:

```sql
WHERE DepartmentID NOT IN (10, 20, NULL)
```

For a department such as 30, the comparison with 10 and 20 is `FALSE`, but
the comparison with `NULL` is `UNKNOWN`. `FALSE OR UNKNOWN` is `UNKNOWN`, and
`NOT UNKNOWN` is still `UNKNOWN`. The `WHERE` clause excludes that row.

Use `NOT EXISTS`, or filter `NULL` values out of the nested query:

```sql
WHERE NOT EXISTS (
  SELECT 1
  FROM ExcludedDepartments AS excluded
  WHERE excluded.DepartmentID = Employees.DepartmentID
)
```

```sql
WHERE DepartmentID NOT IN (
  SELECT DepartmentID
  FROM ExcludedDepartments
  WHERE DepartmentID IS NOT NULL
)
```

### Incompatible data types

The expressions in `COALESCE` should have compatible data types. The result
expressions in a `CASE` expression should also have compatible types.

For example, this expression can cause a type-conversion error in a strict
SQL engine:

```sql
COALESCE(Commission, 'N/A')
```

If you need a text fallback, convert the numeric value to text explicitly.
The cast syntax depends on the database engine:

```sql
COALESCE(CAST(Commission AS VARCHAR(20)), 'N/A')
```

Use a numeric fallback such as `0` when the result is part of a numeric
calculation.

### `NULL` values in aggregate functions

Aggregate functions such as `SUM`, `AVG`, and `COUNT(column)` generally ignore
`NULL` values. As a result, `AVG(Commission)` calculates the average only for
employees with a non-`NULL` commission.

If a missing commission should count as zero, use:

```sql
AVG(COALESCE(Commission, 0))
```

This changes both the sum and the number of values included in the average.
Use it only when that interpretation matches the data model.

### Assuming that `CASE` always prevents an error

Don't rely on a `CASE` expression alone to protect every unsafe expression
from evaluation. Query optimizers can transform expressions, and evaluation
details vary by database engine.

For division, use `NULLIF` directly in the denominator:

```sql
100 / NULLIF(x, 0)
```

You can still use `CASE` to choose how to display or classify the resulting
`NULL` value.

## Key takeaways

- SQL uses `TRUE`, `FALSE`, and `UNKNOWN`. Comparisons with `NULL` usually
  produce `UNKNOWN`.
- Use `IS NULL` and `IS NOT NULL` to test for missing values.
- Use `CASE` for conditional values and classifications.
- Use `COALESCE` to select the first non-`NULL` value.
- Use `NULLIF` to convert a specific value, such as zero, to `NULL`.
- Check data types when combining `COALESCE` arguments or `CASE` results.
- Decide explicitly whether a missing value should remain missing or represent
  a default such as zero.
