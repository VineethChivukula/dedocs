# Basic aggregations and grouping

## Overview

SQL aggregation functions summarize rows and return metrics such as counts,
totals, averages, minimums, and maximums. Use `GROUP BY` to calculate those
metrics for distinct groups, and use `HAVING` to filter the grouped results.

This guide introduces the core aggregation functions and explains how
`WHERE`, `GROUP BY`, and `HAVING` work together.

## Aggregate functions

An aggregate function calculates a value from a set of rows. When a query
doesn't include `GROUP BY`, the database treats all rows selected by the query
as one group.

### `COUNT`

`COUNT` returns the number of items in a group.

- `COUNT(*)` counts every row, including rows that contain `NULL` values.
- `COUNT(column_name)` counts only rows where the specified column isn't
  `NULL`.

For example:

```sql
SELECT
  COUNT(*) AS TotalOrders,
  COUNT(OrderAmount) AS OrdersWithAmounts
FROM Orders;
```

`TotalOrders` includes every row in `Orders`. `OrdersWithAmounts` excludes
rows where `OrderAmount` is `NULL`.

### `SUM`

`SUM(column_name)` calculates the total of the non-`NULL` numeric values in a
group. If the group has no non-`NULL` values, the result can be `NULL`,
depending on the database engine. Use `COALESCE` when your app needs
to represent that result as zero:

```sql
SELECT COALESCE(SUM(OrderAmount), 0) AS TotalRevenue
FROM Orders;
```

### `AVG`

`AVG(column_name)` calculates the arithmetic mean of the non-`NULL` values in
a group. Conceptually, it divides the sum by the count of non-`NULL` values:

```text
AVG(column_name) = SUM(column_name) / COUNT(column_name)
```

For example, `AVG` returns `200` for the values `100`, `200`, `300`, and
`NULL`. It divides the sum, `600`, by 3 rather than by 4.

If `NULL` should represent zero in your data model, convert it before
calculating the average:

```sql
SELECT AVG(COALESCE(OrderAmount, 0)) AS AvgOrderValue
FROM Orders;
```

This changes the calculation. Use it only when treating missing values as
zero matches your business rules.

### `MIN` and `MAX`

`MIN(column_name)` returns the lowest value in a group. `MAX(column_name)`
returns the highest value. Both functions ignore `NULL` values.

You can use these functions with values that have an ordering, including
numbers, strings, dates, and timestamps:

```sql
SELECT
  MIN(OrderDate) AS FirstOrder,
  MAX(OrderDate) AS LastOrder
FROM Orders;
```

## `GROUP BY`

The `GROUP BY` clause partitions rows into groups that share the same values
in one or more columns. Aggregate functions then calculate one result for
each group.

For example, this query returns one row for each category:

```sql
SELECT
  Category,
  COUNT(*) AS TotalOrders,
  SUM(OrderAmount) AS TotalRevenue
FROM Orders
GROUP BY Category;
```

### The `GROUP BY` rule

Every selected expression must either:

- Appear in the `GROUP BY` clause, or
- Use an aggregate function.

For example, this query follows the rule:

```sql
SELECT
  Category,
  COUNT(*) AS TotalOrders
FROM Orders
GROUP BY Category;
```

The following query violates the rule because `OrderDate` isn't grouped
nor aggregated:

```sql
SELECT
  Category,
  OrderDate,
  COUNT(*) AS TotalOrders
FROM Orders
GROUP BY Category;
```

The database can't choose one `OrderDate` value to display for a category
that contains multiple orders. Most database engines reject this query. Some
configurations allow it and return an arbitrary value, which can make results
unreliable.

## `WHERE` and `HAVING`

Use `WHERE` to filter individual rows before grouping. Use `HAVING` to filter
groups after aggregation.

The logical processing order is:

1. `WHERE` filters rows from the source tables.
2. `GROUP BY` collects the remaining rows into groups.
3. Aggregate functions calculate values for each group.
4. `HAVING` filters the resulting groups.
5. `SELECT` returns the requested columns and calculated values.

`WHERE` can't contain an aggregate condition such as `SUM(OrderAmount) > 1000`
because the database hasn't formed the groups when it evaluates `WHERE`.
Place aggregate conditions in `HAVING` instead:

```sql
SELECT
  Category,
  SUM(OrderAmount) AS TotalRevenue
FROM Orders
WHERE OrderDate >= '2025-01-01'
GROUP BY Category
HAVING SUM(OrderAmount) > 1000;
```

Use `WHERE` for conditions on individual rows, even when the same condition
could appear in `HAVING`. Filtering rows before grouping usually reduces the
amount of data that the database must group and aggregate.

## Complete example

Suppose that an `Orders` table contains `OrderID`, `CustomerID`, `Category`,
`OrderAmount`, and `OrderDate`. The following query returns categories with at
least 5 orders, an average order value greater than 100, and orders from 2025
onward:

```sql
SELECT
  Category,
  COUNT(*) AS TotalOrders,
  COUNT(OrderAmount) AS OrdersWithAmounts,
  SUM(OrderAmount) AS TotalRevenue,
  AVG(OrderAmount) AS AvgOrderValue,
  MIN(OrderAmount) AS SmallestOrder,
  MAX(OrderAmount) AS LargestOrder
FROM Orders
WHERE OrderDate >= '2025-01-01'
GROUP BY Category
HAVING COUNT(*) >= 5
   AND AVG(OrderAmount) > 100.00;
```

In this query:

- `WHERE` removes rows before aggregation.
- `GROUP BY` creates one group for each `Category`.
- The aggregate functions calculate metrics for each category.
- `HAVING` keeps only groups that meet both aggregate conditions.

## Common pitfalls

### `NULL` values in `AVG`

`AVG(column)` ignores `NULL` values. It doesn't treat a missing value as zero.
For example, the average of `100`, `200`, `300`, and `NULL` is `200`, not
`150`.

If the business meaning of `NULL` is zero, use
`AVG(COALESCE(column, 0))`. Otherwise, use the default behavior so that
missing values don't change the count of observations.

### `COUNT(*)` and `COUNT(column)`

`COUNT(*)` counts rows. `COUNT(column)` counts non-`NULL` values in that
column. These expressions can return different results:

```sql
SELECT
  COUNT(*) AS TotalRows,
  COUNT(OrderAmount) AS RowsWithAmounts
FROM Orders;
```

Use `COUNT(*)` when you need the number of rows. Use `COUNT(column)` when you
need the number of rows that contain a value in that column.

### Columns that aren't aggregated

Don't select a column that isn't aggregated or included in `GROUP BY`.
The database can't determine which value to return when a group contains
multiple values for that column.

If you need a representative value, define how to choose it. For example, use
an aggregate function, a window function, or a separate query that selects
the first or last row according to an explicit ordering.

### Aggregate conditions in `WHERE`

Don't put aggregate conditions in `WHERE`:

```sql
-- Invalid
WHERE SUM(OrderAmount) > 1000
```

Use `HAVING`:

```sql
HAVING SUM(OrderAmount) > 1000
```

The database evaluates `WHERE` before it forms groups, so aggregate values
don't exist at that stage.

### Row filters in `HAVING`

Avoid using `HAVING` for conditions that apply to individual rows:

```sql
-- Less efficient when the condition can be applied before grouping
GROUP BY Category
HAVING Category = 'Electronics'
```

Prefer:

```sql
WHERE Category = 'Electronics'
GROUP BY Category
```

The `WHERE` version can discard rows before grouping. This can reduce memory
use and execution time, especially for large tables. The actual performance
depends on the database engine, indexes, and query plan.

## Key takeaways

- Aggregate functions summarize values across rows.
- `COUNT(*)` counts rows, while `COUNT(column)` counts non-`NULL` values.
- `GROUP BY` creates one result group for each distinct group key.
- Every selected non-aggregate expression must appear in `GROUP BY`.
- Use `WHERE` to filter rows before aggregation.
- Use `HAVING` to filter groups after aggregation.
- Handle `NULL` values explicitly when they affect business calculations.
