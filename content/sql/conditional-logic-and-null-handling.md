# Conditional logic and null handling

## Overview

SQL uses conditional expressions to choose values, classify records, and handle missing information. Understanding SQL three-valued logic and `NULL` is essential because comparisons with `NULL` don't behave like comparisons between standard values.

This guide provides an end-to-end operational reference for three-valued logic, `CASE` expressions, `COALESCE`, `NULLIF`, null arithmetic propagation, and aggregate behavior across columns that accept nulls.

## Example dataset

The examples in this guide use the following `SalesRepresentatives` table, which includes null commissions and zero unit counts to illustrate edge cases:

| `EmployeeID` | `Name` | `BaseSalary` | `Commission` | `UnitsSold` | `Revenue` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 101 | Alice | 80000.00 | 5000.00 | 100 | 25000.00 |
| 102 | Bob | 60000.00 | `NULL` | 0 | 0.00 |
| 103 | Charlie | 70000.00 | 3000.00 | 50 | 15000.00 |
| 104 | Diana | 90000.00 | `NULL` | `NULL` | `NULL` |

## Three-valued logic

Standard Boolean logic operates on two values: `TRUE` and `FALSE`. SQL implements three-valued logic, introducing a third state: `UNKNOWN`.

A `NULL` marker represents missing or inapplicable data. Because the database engine doesn't know the actual value behind `NULL`, standard equality or inequality comparisons yield `UNKNOWN`:

```sql
-- All three expressions evaluate to UNKNOWN:
Commission = 5000.00
Commission <> 5000.00
Commission = NULL
```

To test for missing values, use `IS NULL` or `IS NOT NULL`.

### Truth table for three-valued logic

| Condition A | Condition B | `A AND B` | `A OR B` | `NOT A` |
| :--- | :--- | :--- | :--- | :--- |
| `TRUE` | `UNKNOWN` | `UNKNOWN` | `TRUE` | `FALSE` |
| `FALSE` | `UNKNOWN` | `FALSE` | `UNKNOWN` | `TRUE` |
| `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |

### Row filtering in the `WHERE` clause

A SQL `WHERE` clause accepts rows only when the filter predicate evaluates strictly to `TRUE`. The engine discards rows that evaluate to `FALSE` or `UNKNOWN`.

```sql
SELECT
  EmployeeID,
  Name,
  Commission
FROM SalesRepresentatives
WHERE Commission > 4000.00;
```

#### Step-by-step predicate evaluation

- Alice: `5000.00 > 4000.00` evaluates to `TRUE`. Retained.
- Bob: `NULL > 4000.00` evaluates to `UNKNOWN`. Discarded.
- Charlie: `3000.00 > 4000.00` evaluates to `FALSE`. Discarded.
- Diana: `NULL > 4000.00` evaluates to `UNKNOWN`. Discarded.

#### Output table

| `EmployeeID` | `Name` | `Commission` |
| :--- | :--- | :--- |
| 101 | Alice | 5000.00 |

## Null arithmetic and `COALESCE`

In SQL, arithmetic expressions containing `NULL` propagate to `NULL`. Adding, subtracting, or multiplying by `NULL` returns `NULL`:

```sql
-- Without null handling, Bob's total earnings become NULL:
SELECT
  Name,
  BaseSalary + Commission AS UnsafeTotalEarnings
FROM SalesRepresentatives;
```

### Output table without null handling

| `Name` | `UnsafeTotalEarnings` |
| :--- | :--- |
| Alice | 85000.00 |
| Bob | `NULL` |
| Charlie | 73000.00 |
| Diana | `NULL` |

Even though Bob earned a base salary of `60000.00`, missing commission information wipes out his calculated earnings.

### Fallback substitution with `COALESCE`

The `COALESCE` function accepts a list of arguments and returns the first non-`NULL` value:

```sql
SELECT
  Name,
  BaseSalary,
  COALESCE(Commission, 0.00) AS CleanCommission,
  BaseSalary + COALESCE(Commission, 0.00) AS SafeTotalEarnings
FROM SalesRepresentatives;
```

### Output table with `COALESCE`

| `Name` | `BaseSalary` | `CleanCommission` | `SafeTotalEarnings` |
| :--- | :--- | :--- | :--- |
| Alice | 80000.00 | 5000.00 | 85000.00 |
| Bob | 60000.00 | 0.00 | 60000.00 |
| Charlie | 70000.00 | 3000.00 | 73000.00 |
| Diana | 90000.00 | 0.00 | 90000.00 |

`COALESCE` substitutes `0.00` for missing commission rows, allowing arithmetic summation to succeed across every record.

## Aggregate function mechanics with nulls

A frequent interview trap and production error involves how SQL aggregate functions handle `NULL` markers.

- `COUNT(*)` counts every row in the partition, regardless of whether column values are null.
- `COUNT(column)` counts only rows where the specified column is non-`NULL`.
- `AVG(column)` computes the arithmetic mean across non-`NULL` rows only. It ignores null rows from both the numerator and the denominator.

```sql
SELECT
  COUNT(*) AS TotalRowCount,
  COUNT(Commission) AS NonNullCommissionCount,
  SUM(Commission) AS SumCommission,
  AVG(Commission) AS AvgIgnoringNulls,
  AVG(COALESCE(Commission, 0.00)) AS AvgIncludingNullsAsZero
FROM SalesRepresentatives;
```

### Aggregate comparison output

| `TotalRowCount` | `NonNullCommissionCount` | `SumCommission` | `AvgIgnoringNulls` | `AvgIncludingNullsAsZero` |
| :--- | :--- | :--- | :--- | :--- |
| 4 | 2 | 8000.00 | **4000.00** | **2000.00** |

### Why the averages diverge

- For `AVG(Commission)`, the engine sums the Alice commission of `5000.00` and the Charlie commission of `3000.00` to get `8000.00`, then divides by `2`, representing the count of non-null commission rows, producing `4000.00`.
- For `AVG(COALESCE(Commission, 0.00))`, the engine treats Bob and Diana as earning `0.00`, dividing `8000.00` by all `4` representatives to produce `2000.00`.

Decide whether business metrics require averaging across active participants or the entire population before selecting aggregate expressions.

## Safe division with `NULLIF`

The `NULLIF` function compares two expressions:

```sql
NULLIF(expression1, expression2)
```

- If both expressions are equal, `NULLIF` returns `NULL`.
- If the expressions differ, `NULLIF` returns `expression1`.

`NULLIF` is commonly used to defend calculations against zero-division exceptions. In standard SQL, dividing any numeric value by `NULL` returns `NULL`, whereas dividing by zero aborts the query with a runtime division-by-zero error.

```sql
SELECT
  Name,
  Revenue,
  UnitsSold,
  ROUND(Revenue / NULLIF(UnitsSold, 0), 2) AS RevenuePerUnit
FROM SalesRepresentatives;
```

### Safe division output table

| `Name` | `Revenue` | `UnitsSold` | `RevenuePerUnit` | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Alice | 25000.00 | 100 | 250.00 | Standard calculation |
| Bob | 0.00 | 0 | `NULL` | `NULLIF(0, 0)` returns `NULL`, avoiding error |
| Charlie | 15000.00 | 50 | 300.00 | Standard calculation |
| Diana | `NULL` | `NULL` | `NULL` | `Revenue` is null |

## Conditional branching with `CASE` expressions

The `CASE` expression provides branching logic directly within SQL queries. SQL supports two syntactic variations: searched `CASE` and simple `CASE`.

### Searched `CASE` expressions

A searched `CASE` expression evaluates a series of independent Boolean expressions:

```sql
SELECT
  Name,
  BaseSalary + COALESCE(Commission, 0.00) AS TotalEarnings,
  CASE
    WHEN BaseSalary + COALESCE(Commission, 0.00) >= 85000.00 THEN 'Tier 1 Executive'
    WHEN BaseSalary + COALESCE(Commission, 0.00) >= 70000.00 THEN 'Tier 2 Senior'
    ELSE 'Tier 3 Associate'
  END AS CompensationTier
FROM SalesRepresentatives
ORDER BY TotalEarnings DESC;
```

#### Searched `CASE` result

| `Name` | `TotalEarnings` | `CompensationTier` |
| :--- | :--- | :--- |
| Diana | 90000.00 | Tier 1 Executive |
| Alice | 85000.00 | Tier 1 Executive |
| Charlie | 73000.00 | Tier 2 Senior |
| Bob | 60000.00 | Tier 3 Associate |

The engine evaluates `WHEN` branches sequentially from top to bottom. When a condition evaluates to `TRUE`, the engine returns the result and stops evaluating subsequent branches. Place specific criteria before general criteria.

### Simple `CASE` expressions

A simple `CASE` expression compares a single input expression against a list of static values:

```sql
SELECT
  Name,
  UnitsSold,
  CASE UnitsSold
    WHEN 100 THEN 'Target Hit'
    WHEN 50 THEN 'Half Target'
    WHEN 0 THEN 'No Sales'
    ELSE 'Other'
  END AS SalesProgress
FROM SalesRepresentatives;
```

Simple `CASE` expressions test for strict value equality. Because `NULL = NULL` evaluates to `UNKNOWN`, a simple `CASE` can't match `WHEN NULL`. Use searched `CASE` with `WHEN column IS NULL` to inspect null values.

## Common pitfalls

### String concatenation with nulls

In standard SQL specifications, concatenating a string with `NULL` using the `||` operator returns `NULL`:

```sql
-- Returns NULL when middle name is missing:
first_name || ' ' || middle_name || ' ' || last_name

-- Reliable solution:
first_name || COALESCE(' ' || middle_name, '') || ' ' || last_name
```

Database engines such as Google BigQuery provide the helper function `CONCAT()`, which automatically treats null arguments as empty strings.

### Unhandled `ELSE` branches in `CASE`

If no `WHEN` condition evaluates to `TRUE` and the expression omits an `ELSE` clause, SQL returns `NULL` by default. Always include an explicit `ELSE` clause to prevent accidental null injection into analytics tables.

## Key takeaways

- SQL evaluates conditions using three-valued logic: `TRUE`, `FALSE`, and `UNKNOWN`.
- A `WHERE` clause filters out records evaluating to `UNKNOWN`.
- Use `IS NULL` and `IS NOT NULL` to test for missing values. Never use `= NULL`.
- `COALESCE` returns the first non-null value from an argument list, protecting arithmetic from null propagation.
- `COUNT(*)` counts every row, while `COUNT(column)` and `AVG(column)` disregard null values.
- `NULLIF(val, 0)` protects division expressions from division-by-zero exceptions by substituting `NULL` into the denominator.
- Searched `CASE` statements evaluate sequentially. Put strict conditions ahead of loose conditions.
