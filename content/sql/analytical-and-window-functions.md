# Analytical and window functions

## Overview

Window functions calculate values across related rows without collapsing those
rows into one summary row. Unlike `GROUP BY`, a window function returns a
value for each input row and preserves the row-level details in the result.

This guide introduces the `OVER` clause, window partitions, window ordering,
ranking functions, and running aggregates.

## Window definitions

A window definition specifies which rows to use for each calculation.
It appears inside the `OVER` clause:

```sql
function_name() OVER (
  PARTITION BY partition_column
  ORDER BY sort_column
)
```

The `PARTITION BY` and `ORDER BY` clauses are optional, but each one changes
the set or order of rows that the function uses.

### `OVER`

The `OVER` clause changes a function from a regular aggregate into a window
function. A regular aggregate such as `SUM(SalesAmount)` returns one value per
group. `SUM(SalesAmount) OVER (...)` returns a value for every row in the
window.

For example, this query returns each employee, along with the total sales for
the entire result:

```sql
SELECT
  EmployeeName,
  SalesAmount,
  SUM(SalesAmount) OVER () AS TotalSales
FROM EmployeeSales;
```

Because the `OVER` clause has no `PARTITION BY`, the database treats all
selected rows as one window.

### `PARTITION BY`

`PARTITION BY` divides the result into logical groups. The window function
calculates a separate result for each partition.

This query calculates a department total while preserving every employee row:

```sql
SELECT
  Department,
  EmployeeName,
  SalesAmount,
  SUM(SalesAmount) OVER (
    PARTITION BY Department
  ) AS DepartmentSales
FROM EmployeeSales;
```

If you omit `PARTITION BY`, the database uses one partition containing all
rows in the result.

### `ORDER BY`

`ORDER BY` inside `OVER` defines the logical order of rows within each
partition. Ranking functions use this order to assign ranks. Aggregate window
functions can also use it to calculate running values.

For example:

```sql
SUM(SalesAmount) OVER (
  PARTITION BY Department
  ORDER BY HireDate
) AS RunningDepartmentSales
```

For aggregate window functions, adding `ORDER BY` usually creates a cumulative
frame that starts at the first row and ends at the current row. The exact
default frame can vary by database engine and function. Specify an explicit
frame when the distinction between peer rows and individual rows matters.

For example, this frame uses every row from the start of the partition through
the current row:

```sql
SUM(SalesAmount) OVER (
  PARTITION BY Department
  ORDER BY HireDate
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) AS RunningDepartmentSales
```

Add a tie-breaker to make the order deterministic:

```sql
ORDER BY SalesAmount DESC, EmployeeName, EmployeeID
```

## Ranking functions

Ranking functions assign a position or bucket to each row in a partition.

### `ROW_NUMBER`

`ROW_NUMBER()` assigns a unique sequential integer to every row. It starts at
1 within each partition:

```sql
ROW_NUMBER() OVER (
  PARTITION BY Department
  ORDER BY SalesAmount DESC, EmployeeID
) AS RowNumber
```

Use `ROW_NUMBER` for pagination, duplicate removal, or selecting one row from
each group. Include enough tie-breaker columns in `ORDER BY` to define which
row comes first.

### `RANK`

`RANK()` assigns the same rank to rows with equal ordering values. It leaves
gaps after ties. If two rows share rank 1, the next row receives rank 3.

```sql
RANK() OVER (
  PARTITION BY Department
  ORDER BY SalesAmount DESC
) AS SalesRank
```

Use `RANK` when tied rows should share a competition-style position.

### `DENSE_RANK`

`DENSE_RANK()` also assigns the same rank to tied rows, but it doesn't leave
gaps. If two rows share rank 1, the next distinct value receives rank 2.

```sql
DENSE_RANK() OVER (
  PARTITION BY Department
  ORDER BY SalesAmount DESC
) AS DenseSalesRank
```

Use `DENSE_RANK` when you need consecutive ranks while preserving ties.

### `NTILE`

`NTILE(n)` divides the ordered rows in each partition into `n` buckets and
returns the bucket number for each row. The database distributes rows as
evenly as possible.

```sql
NTILE(4) OVER (
  PARTITION BY Department
  ORDER BY SalesAmount DESC
) AS PerformanceQuartile
```

The bucket numbers range from 1 through `n`. If the number of rows isn't
evenly divisible by `n`, some buckets contain one more row than others.

## Compare ranking functions

| Function | Ties | Gaps | Common use |
| --- | --- | --- | --- |
| `ROW_NUMBER()` | Assigns a different number to every row. | No gaps. | Pagination and duplicate removal. |
| `RANK()` | Tied rows share a rank. | Leaves gaps after ties. | Competition ranking. |
| `DENSE_RANK()` | Tied rows share a rank. | No gaps after ties. | Top-N results with ties. |
| `NTILE(n)` | Assigns rows to buckets. | Bucket numbers remain consecutive. | Quartiles and other groups. |

## Complete example

Suppose that an `EmployeeSales` table contains `Department`,
`EmployeeName`, `EmployeeID`, `SalesAmount`, and `HireDate`. The following
query calculates several metrics for each employee:

```sql
SELECT
  Department,
  EmployeeName,
  SalesAmount,
  ROW_NUMBER() OVER (
    PARTITION BY Department
    ORDER BY SalesAmount DESC, EmployeeID
  ) AS RowNumber,
  RANK() OVER (
    PARTITION BY Department
    ORDER BY SalesAmount DESC
  ) AS SalesRank,
  DENSE_RANK() OVER (
    PARTITION BY Department
    ORDER BY SalesAmount DESC
  ) AS DenseSalesRank,
  NTILE(2) OVER (
    PARTITION BY Department
    ORDER BY SalesAmount DESC, EmployeeID
  ) AS PerformanceBucket,
  SUM(SalesAmount) OVER (
    PARTITION BY Department
    ORDER BY SalesAmount DESC, EmployeeID
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS RunningDepartmentSales
FROM EmployeeSales;
```

For the following rows in the `Sales` department:

| EmployeeName | SalesAmount |
| --- | ---: |
| Alice | 10000 |
| Bob | 8000 |
| Charlie | 8000 |
| Diana | 5000 |

The ranking and running-total columns are:

| EmployeeName | `ROW_NUMBER` | `RANK` | `DENSE_RANK` | `NTILE(2)` | Running sales |
| --- | ---: | ---: | ---: | ---: | ---: |
| Alice | 1 | 1 | 1 | 1 | 10000 |
| Bob | 2 | 2 | 2 | 1 | 18000 |
| Charlie | 3 | 2 | 2 | 2 | 26000 |
| Diana | 4 | 4 | 3 | 2 | 31000 |

`ROW_NUMBER` uses `EmployeeID` as a tie-breaker in this example. `RANK` and
`DENSE_RANK` use only `SalesAmount`, so Bob and Charlie share the same rank.

## Filtering window-function results

You can't reference a window function directly in the `WHERE` or `HAVING`
clause at the same query level because those clauses run before the `SELECT`
list runs. Compute the window value in a nested query or common table
expression, then filter it in an outer query.

For example, to return the top 3 employees in each department:

```sql
WITH ranked_sales AS (
  SELECT
    Department,
    EmployeeName,
    SalesAmount,
    ROW_NUMBER() OVER (
      PARTITION BY Department
      ORDER BY SalesAmount DESC, EmployeeID
    ) AS RowNumber
  FROM EmployeeSales
)
SELECT
  Department,
  EmployeeName,
  SalesAmount
FROM ranked_sales
WHERE RowNumber <= 3;
```

## Common pitfalls

### Filtering window functions directly

This query is invalid in many SQL dialects because `ROW_NUMBER` isn't
available to `WHERE` at the same query level:

```sql
-- Invalid at this query level.
SELECT
  EmployeeName,
  ROW_NUMBER() OVER (ORDER BY SalesAmount DESC) AS RowNumber
FROM EmployeeSales
WHERE RowNumber <= 3;
```

Use a nested query or common table expression as shown in the previous section.
Some database engines provide a dialect-specific `QUALIFY` clause. Check the
engine documentation before using it.

### Unintended running totals

Adding `ORDER BY` to an aggregate window function can change a total into a
cumulative value:

```sql
SUM(SalesAmount) OVER (
  PARTITION BY Department
  ORDER BY HireDate
)
```

If you need the same department total on every row, omit the window
`ORDER BY`:

```sql
SUM(SalesAmount) OVER (
  PARTITION BY Department
)
```

If you need a running total, specify the frame explicitly so the intended
behavior is clear.

### Non-deterministic `ROW_NUMBER` results

If the `ORDER BY` values tie, the database can assign tied rows different
`ROW_NUMBER` values on different executions. Add a unique tie-breaker, such as
`EmployeeID`, to make the result stable:

```sql
ROW_NUMBER() OVER (
  PARTITION BY Department
  ORDER BY SalesAmount DESC, EmployeeID
)
```

`RANK` and `DENSE_RANK` are appropriate when tied values should retain the
same position.

### `NULL` values in partitions and ordering

Rows with `NULL` in a `PARTITION BY` column belong to the same `NULL`
partition. The database also determines where `NULL` values appear in an
`ORDER BY` expression according to its engine and null-ordering rules.

If the placement of `NULL` values matters, define it explicitly. For example:

```sql
ORDER BY
  CASE WHEN SalesAmount IS NULL THEN 1 ELSE 0 END,
  SalesAmount DESC
```

This expression places non-`NULL` sales amounts before `NULL` amounts. Use a
clear business rule when deciding how missing values should rank.

## Key takeaways

- Use `OVER` to calculate values across rows without collapsing the result.
- Use `PARTITION BY` to calculate values independently for logical groups.
- Use `ORDER BY` to define ranking order or calculate running values.
- Use `ROW_NUMBER`, `RANK`, `DENSE_RANK`, and `NTILE` for different ranking
  requirements.
- Add tie-breakers when a deterministic row order matters.
- Filter window-function results in an outer query or with a supported
  `QUALIFY` clause.
- Specify an explicit frame when running-total behavior must be predictable.
- Define the partition and sort behavior for `NULL` values.
