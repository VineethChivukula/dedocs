# Multidimensional aggregation

## Overview

Multidimensional aggregation produces detail rows, subtotals, and grand
totals in one query. It extends `GROUP BY` with `GROUPING SETS`, `ROLLUP`, and
`CUBE`.

Use these operators when a report needs several levels of aggregation. They
can replace multiple `UNION ALL` queries and keep the aggregation logic in one
statement.

## `GROUPING SETS`

`GROUPING SETS` lets you specify the exact grouping combinations to calculate:

```sql
GROUP BY GROUPING SETS (
  (Department, JobTitle),
  (Department),
  ()
)
```

This expression produces:

- One row for each `Department` and `JobTitle` combination.
- One subtotal row for each `Department`.
- One grand-total row from the empty grouping set, `()`.

Use `GROUPING SETS` when you need precise control over the report levels and
don't need every possible combination.

For example:

```sql
SELECT
  Department,
  JobTitle,
  SUM(Salary) AS TotalSalary
FROM Employees
GROUP BY GROUPING SETS (
  (Department, JobTitle),
  (Department),
  ()
);
```

## `ROLLUP`

`ROLLUP` creates hierarchical subtotals from the ordered list of grouping
columns. It produces a detail level, then removes columns from right to left
to create subtotals, and finally produces a grand total.

```sql
SELECT
  Region,
  Category,
  SUM(SalesAmount) AS TotalSales
FROM Sales
GROUP BY ROLLUP (Region, Category);
```

This query produces:

1. A row for each `Region` and `Category`.
2. A subtotal for each `Region`.
3. One grand total.

Column order matters. `ROLLUP(Category, Region)` creates category subtotals,
not region subtotals.

## `CUBE`

`CUBE` creates grouping sets for every combination of the specified columns,
including the grand total:

```sql
SELECT
  Region,
  Category,
  SUM(SalesAmount) AS TotalSales
FROM Sales
GROUP BY CUBE (Region, Category);
```

For two columns, `CUBE` produces four grouping combinations:

- `(Region, Category)`
- `(Region)`
- `(Category)`
- `()`

For `n` grouping columns, the number of combinations can grow to `2^n`.
Use `CUBE` when the report needs every combination. Use `GROUPING SETS` when
you need only selected combinations.

## `GROUPING`

`ROLLUP` and `CUBE` use `NULL` in grouped columns to represent a subtotal or
grand-total level. However, the source data might also contain a real `NULL`
value. The `GROUPING(column)` function distinguishes these cases:

- `GROUPING(column) = 0` means the column participates in that grouping level.
- `GROUPING(column) = 1` means the query aggregated the column away for a
  subtotal or grand-total row.

Use `GROUPING()` to label report rows:

```sql
SELECT
  CASE
    WHEN GROUPING(Region) = 1 THEN 'All regions'
    ELSE Region
  END AS RegionLabel,
  CASE
    WHEN GROUPING(Category) = 1 THEN 'All categories'
    ELSE Category
  END AS CategoryLabel,
  SUM(SalesAmount) AS TotalSales
FROM Sales
GROUP BY CUBE (Region, Category);
```

When the source column is numeric, cast it before combining it with a text
label:

```sql
CASE
  WHEN GROUPING(DepartmentID) = 1 THEN 'All'
  ELSE CAST(DepartmentID AS VARCHAR(20))
END AS DepartmentLabel
```

The cast syntax and supported text type depend on the database engine.

## Filtering detail rows and totals

Use `WHERE` to filter source rows before the database calculates grouping
sets. Use `HAVING` to filter aggregated rows after grouping.

For example:

```sql
SELECT
  Region,
  Category,
  SUM(SalesAmount) AS TotalSales
FROM Sales
WHERE SaleDate >= '2026-01-01'
GROUP BY CUBE (Region, Category)
HAVING SUM(SalesAmount) > 1000;
```

The `WHERE` clause affects the detail rows that contribute to every subtotal
and total. The `HAVING` clause can remove individual grouping-set results,
including subtotal and grand-total rows.

To filter a specific grouping level, use `GROUPING()` in `HAVING`:

```sql
HAVING
  GROUPING(Region) = 0
  AND GROUPING(Category) = 1
```

This condition keeps only region subtotal rows.

## Complete example

Suppose a `Sales` table contains `Region`, `Category`, and `SalesAmount`.
The following query creates detail rows, regional subtotals, category
subtotals, and a grand total:

```sql
SELECT
  CASE
    WHEN GROUPING(Region) = 1 THEN 'All regions'
    ELSE Region
  END AS RegionLabel,
  CASE
    WHEN GROUPING(Category) = 1 THEN 'All categories'
    ELSE Category
  END AS CategoryLabel,
  GROUPING(Region) AS IsRegionSubtotal,
  GROUPING(Category) AS IsCategorySubtotal,
  SUM(SalesAmount) AS TotalSales
FROM Sales
GROUP BY CUBE (Region, Category)
ORDER BY
  GROUPING(Region),
  GROUPING(Category),
  Region,
  Category;
```

For this source data:

| Region | Category | SalesAmount |
| --- | --- | ---: |
| North | Electronics | 50000 |
| North | Furniture | 30000 |
| South | Electronics | 40000 |
| South | Furniture | 20000 |

The query returns rows similar to these:

| Region label | Category label | Region grouping | Category grouping | Total sales | Level |
| --- | --- | ---: | ---: | ---: | --- |
| North | Electronics | 0 | 0 | 50000 | Detail |
| North | Furniture | 0 | 0 | 30000 | Detail |
| South | Electronics | 0 | 0 | 40000 | Detail |
| South | Furniture | 0 | 0 | 20000 | Detail |
| North | All categories | 0 | 1 | 80000 | Region subtotal |
| South | All categories | 0 | 1 | 60000 | Region subtotal |
| All regions | Electronics | 1 | 0 | 90000 | Category subtotal |
| All regions | Furniture | 1 | 0 | 50000 | Category subtotal |
| All regions | All categories | 1 | 1 | 140000 | Grand total |

The grouping flags let applications identify the row level without relying on
display labels.

## Common pitfalls

### Combinatorial growth with `CUBE`

`CUBE` can produce up to `2^n` grouping combinations for `n` columns. The
number of result rows can grow quickly, especially when each combination has
many distinct values.

Use `GROUPING SETS` for a smaller set of required levels. Filter source rows
with `WHERE` and select only the grouping columns that the report needs.

### Filtering totals with `WHERE`

`WHERE` runs before aggregation, so it can't filter a calculated subtotal or
grand total. Use `HAVING` for aggregate conditions and `GROUPING()` to select
a specific subtotal level.

### Dialect and syntax differences

Support for `GROUPING SETS`, `ROLLUP`, `CUBE`, and `GROUPING()` varies by
database engine. Syntax can also differ for combining these operators with
ordinary grouping columns.

Check the database engine documentation before relying on a feature in
portable SQL. If an engine doesn't support the required grouping operator, you
might need separate queries or a compatible reporting layer.

### Data type mismatches in labels

`CASE` branches must return compatible data types. A numeric department
identifier doesn't always work directly with a text label such as
`'All'`.

Cast the identifier to text before using it in the `ELSE` branch:

```sql
CASE
  WHEN GROUPING(DepartmentID) = 1 THEN 'All'
  ELSE CAST(DepartmentID AS VARCHAR(20))
END
```

Choose a cast type supported by the database engine.

### Confusing source `NULL` values with subtotals

A `NULL` in a grouped column can come from the source data or from an
aggregation level created by `ROLLUP` or `CUBE`. Use `GROUPING()` to tell the
two cases apart before displaying or filtering the result.

## Key takeaways

- Use `GROUPING SETS` for explicitly selected aggregation levels.
- Use `ROLLUP` for hierarchical subtotals based on column order.
- Use `CUBE` for all combinations of the specified grouping columns.
- Use `GROUPING()` to distinguish subtotal placeholders from source `NULL`
  values.
- Use `WHERE` to filter source rows and `HAVING` to filter grouped results.
- Prefer `GROUPING SETS` when `CUBE` would generate unnecessary combinations.
- Check data types and database-engine support before labeling or deploying a
  multidimensional report.
