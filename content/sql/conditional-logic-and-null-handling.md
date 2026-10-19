# Conditional logic and null handling

## Overview

Structured Query Language, or `SQL`, uses conditional expressions to evaluate
branching paths, categorize metrics, and process missing data. Understanding
`SQL` three-valued logic and `NULL` semantics is critical for reliable data
engineering because comparisons involving `NULL` yield unknown truth values
rather than standard binary outcomes.

This guide details three-valued logic, `CASE` expressions, `COALESCE`, `NULLIF`,
null arithmetic propagation, and aggregate functions over attributes that
accept nulls using the Stanford University faculty database.

## Reference schema and dataset

The examples in this guide use the `faculty_researchers` relation from the
Stanford University academic payroll system. The dataset includes optional
stipends that accept nulls, zero-valued student advisee counts, and null budgets
to illustrate edge cases:

```sql
CREATE TABLE faculty_researchers (
  instructor_id    INTEGER PRIMARY KEY,
  first_name       VARCHAR(50) NOT NULL,
  last_name        VARCHAR(50) NOT NULL,
  middle_name      VARCHAR(50),
  base_salary      NUMERIC(10, 2) NOT NULL,
  research_stipend NUMERIC(10, 2),
  advisee_count    INTEGER,
  travel_budget    NUMERIC(10, 2)
);
```

### Table contents

| `instructor_id` | `first_name` | `last_name` | `base_salary` | `research_stipend` | `advisee_count` | `travel_budget` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | David | Clark | `120000.00` | `15000.00` | `12` | `6000.00` |
| `102` | Marcus | Miller | `95000.00` | `NULL` | `0` | `0.00` |
| `103` | Andrea | Taylor | `110000.00` | `8000.00` | `6` | `3600.00` |
| `104` | Sarah | Wilson | `130000.00` | `NULL` | `NULL` | `NULL` |

## Three-valued logic

Standard Boolean algebra operates on two states: `TRUE` and `FALSE`. Relational
engines evaluate predicates using three-valued logic, which adds a third state:
`UNKNOWN`.

A `NULL` marker represents missing, unknown, or inapplicable information.
Because the engine can't verify the underlying data value, comparison predicates
evaluating `NULL` resolve to `UNKNOWN`:

```sql
-- All three expressions evaluate to UNKNOWN:
research_stipend = 15000.00
research_stipend <> 15000.00
research_stipend = NULL
```

To test for missing values, use `IS NULL` or `IS NOT NULL`.

### Truth table for three-valued logic

| Condition A | Condition B | `A AND B` | `A OR B` | `NOT A` |
| :--- | :--- | :--- | :--- | :--- |
| `TRUE` | `UNKNOWN` | `UNKNOWN` | `TRUE` | `FALSE` |
| `FALSE` | `UNKNOWN` | `FALSE` | `UNKNOWN` | `TRUE` |
| `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |

### Row filtering in the `WHERE` clause

A `SQL` `WHERE` clause accepts rows only when the filter predicate evaluates
strictly to `TRUE`. The engine discards rows that evaluate to `FALSE` or `UNKNOWN`:

```sql
SELECT
  instructor_id,
  first_name,
  last_name,
  research_stipend
FROM faculty_researchers
WHERE research_stipend > 10000.00;
```

#### Predicate evaluation trace

- David Clark: `15000.00 > 10000.00` evaluates to `TRUE`. Retained.
- Marcus Miller: `NULL > 10000.00` evaluates to `UNKNOWN`. Discarded.
- Andrea Taylor: `8000.00 > 10000.00` evaluates to `FALSE`. Discarded.
- Sarah Wilson: `NULL > 10000.00` evaluates to `UNKNOWN`. Discarded.

#### Result set

| `instructor_id` | `first_name` | `last_name` | `research_stipend` |
| :--- | :--- | :--- | :--- |
| `101` | David | Clark | `15000.00` |

## Null arithmetic propagation and `COALESCE`

In `SQL`, standard mathematical expressions containing `NULL` propagate to
`NULL`. Adding, subtracting, or multiplying by `NULL` returns `NULL`:

```sql
-- Without null handling, Marcus Miller and Sarah Wilson total earnings evaluate to NULL:
SELECT
  first_name,
  last_name,
  base_salary + research_stipend AS unsafe_total_comp
FROM faculty_researchers;
```

### Result set without null handling

| `first_name` | `last_name` | `unsafe_total_comp` |
| :--- | :--- | :--- |
| David | Clark | `135000.00` |
| Marcus | Miller | `NULL` |
| Andrea | Taylor | `118000.00` |
| Sarah | Wilson | `NULL` |

Even though Marcus Miller earned a base salary of `95000.00`, the missing
stipend erases his total compensation metric.

### Fallback substitution with `COALESCE`

The `COALESCE` function accepts a list of arguments and returns the first
non-`NULL` value:

```sql
SELECT
  first_name,
  last_name,
  base_salary,
  COALESCE(research_stipend, 0.00) AS clean_stipend,
  base_salary + COALESCE(research_stipend, 0.00) AS safe_total_comp
FROM faculty_researchers;
```

### Result set with `COALESCE`

| `first_name` | `last_name` | `base_salary` | `clean_stipend` | `safe_total_comp` |
| :--- | :--- | :--- | :--- | :--- |
| David | Clark | `120000.00` | `15000.00` | `135000.00` |
| Marcus | Miller | `95000.00` | `0.00` | `95000.00` |
| Andrea | Taylor | `110000.00` | `8000.00` | `118000.00` |
| Sarah | Wilson | `130000.00` | `0.00` | `130000.00` |

`COALESCE` substitutes `0.00` for missing stipends, allowing arithmetic
summation to succeed across all records.

## Aggregate function behavior with null values

Aggregate functions handle `NULL` markers differently depending on the syntax:

- `COUNT(*)` counts every row in the partition, including rows containing null attributes.
- `COUNT(column)` counts only rows where the specified column is non-`NULL`.
- `AVG(column)` computes the arithmetic mean across non-`NULL` rows only. It ignores null rows from both the numerator and the denominator.

```sql
SELECT
  COUNT(*) AS total_faculty,
  COUNT(research_stipend) AS faculty_with_stipend,
  SUM(research_stipend) AS total_stipend_expenditure,
  AVG(research_stipend) AS avg_stipend_awarded,
  AVG(COALESCE(research_stipend, 0.00)) AS avg_stipend_all_faculty
FROM faculty_researchers;
```

### Aggregate comparison output

| `total_faculty` | `faculty_with_stipend` | `total_stipend_expenditure` | `avg_stipend_awarded` | `avg_stipend_all_faculty` |
| :--- | :--- | :--- | :--- | :--- |
| `4` | `2` | `23000.00` | `11500.00` | `5750.00` |

### Divergence between non-null and all-row averages

- For `AVG(research_stipend)`, the engine sums the stipends of David Clark,
  `15000.00`, and Andrea Taylor, `8000.00`, to get `23000.00`. It then divides
  by `2`, representing the count of non-null stipend rows, producing `11500.00`.
- For `AVG(COALESCE(research_stipend, 0.00))`, the engine treats Marcus Miller
  and Sarah Wilson as receiving `0.00`, dividing `23000.00` across all `4`
  faculty members to produce `5750.00`.

Decide whether analytical reporting requires averaging across active grant
recipients or across the entire faculty body before choosing aggregate expressions.

## Safe division with `NULLIF`

The `NULLIF` function compares two expressions:

```sql
NULLIF(expression1, expression2)
```

- If both expressions are equal, `NULLIF` returns `NULL`.
- If the expressions differ, `NULLIF` returns `expression1`.

Use `NULLIF` to guard calculations against division-by-zero exceptions. In `SQL`,
dividing a numeric value by `NULL` returns `NULL`, whereas dividing by zero
terminates query execution with a runtime error:

```sql
SELECT
  first_name,
  last_name,
  travel_budget,
  advisee_count,
  ROUND(travel_budget / NULLIF(advisee_count, 0), 2) AS travel_budget_per_advisee
FROM faculty_researchers;
```

### Safe division output table

| `first_name` | `last_name` | `travel_budget` | `advisee_count` | `travel_budget_per_advisee` | Evaluation notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| David | Clark | `6000.00` | `12` | `500.00` | Standard division |
| Marcus | Miller | `0.00` | `0` | `NULL` | `NULLIF(0, 0)` returns `NULL`, preventing zero division |
| Andrea | Taylor | `3600.00` | `6` | `600.00` | Standard division |
| Sarah | Wilson | `NULL` | `NULL` | `NULL` | Budget is `NULL` |

## Conditional branching with `CASE` expressions

The `CASE` expression provides branching logic directly within `SQL` queries.
`SQL` supports two syntactic forms: searched `CASE` and simple `CASE`.

### Searched `CASE` expressions

A searched `CASE` expression evaluates a list of independent Boolean predicates:

```sql
SELECT
  first_name,
  last_name,
  base_salary + COALESCE(research_stipend, 0.00) AS total_comp,
  CASE
    WHEN base_salary + COALESCE(research_stipend, 0.00) >= 130000.00 THEN 'Distinguished Scholar'
    WHEN base_salary + COALESCE(research_stipend, 0.00) >= 110000.00 THEN 'Senior Scholar'
    ELSE 'Junior Scholar'
  END AS compensation_tier
FROM faculty_researchers
ORDER BY total_comp DESC;
```

#### Searched `CASE` result

| `first_name` | `last_name` | `total_comp` | `compensation_tier` |
| :--- | :--- | :--- | :--- |
| David | Clark | `135000.00` | Distinguished Scholar |
| Sarah | Wilson | `130000.00` | Distinguished Scholar |
| Andrea | Taylor | `118000.00` | Senior Scholar |
| Marcus | Miller | `95000.00` | Junior Scholar |

The engine evaluates `WHEN` branches sequentially from top to bottom. When a
condition evaluates to `TRUE`, the engine returns the result and stops evaluating
subsequent branches. Place specific criteria ahead of broad criteria.

### Simple `CASE` expressions

A simple `CASE` expression compares a single input expression against static
values:

```sql
SELECT
  first_name,
  last_name,
  advisee_count,
  CASE advisee_count
    WHEN 12 THEN 'Heavy Mentoring'
    WHEN 6  THEN 'Standard Mentoring'
    WHEN 0  THEN 'No Advising Duties'
    ELSE 'Other'
  END AS mentoring_profile
FROM faculty_researchers;
```

Simple `CASE` expressions test for strict equality. Because `NULL = NULL`
evaluates to `UNKNOWN`, a simple `CASE` can't match `WHEN NULL`. Use searched
`CASE` with `WHEN column IS NULL` to inspect null markers.

## Common pitfalls

### String concatenation with null values

In standard `SQL`, concatenating text with `NULL` using the `||` operator returns
`NULL`:

```sql
-- Returns NULL when middle_name is missing:
first_name || ' ' || middle_name || ' ' || last_name

-- Reliable query using COALESCE:
first_name || COALESCE(' ' || middle_name, '') || ' ' || last_name
```

Data warehouses like Google BigQuery provide the `CONCAT()` function,
which treats null arguments as empty strings.

### Unhandled `ELSE` clauses in `CASE` statements

If no `WHEN` condition evaluates to `TRUE` and the expression omits an `ELSE`
clause, `SQL` returns `NULL` by default. Always write an explicit `ELSE` clause
to avoid unintended null injection into production reporting tables.

## Key takeaways

- `SQL` evaluates conditions using three-valued logic: `TRUE`, `FALSE`, and `UNKNOWN`.
- A `WHERE` clause filters out rows that evaluate to `UNKNOWN`.
- Test for missing information with `IS NULL` and `IS NOT NULL`. Never compare with `= NULL`.
- `COALESCE` returns the first non-null argument, protecting arithmetic operations from null propagation.
- `COUNT(*)` counts all records, while `COUNT(column)` and `AVG(column)` ignore null values.
- `NULLIF(val, 0)` protects division expressions from division-by-zero errors by substituting `NULL` into the denominator.
- Searched `CASE` statements evaluate sequentially. Place restrictive conditions before general fallback criteria.

## What's next

- Master scalar and correlated sub-queries and the `NOT IN (NULL)` trap in
  [Sub-queries and set operations](/sql/subqueries-and-set-operations).
- Explore window functions, partition frames, and rankings in
  [Analytical and window functions](/sql/analytical-and-window-functions).
- Learn sequential common table expression chaining and query optimization in
  [Common table expressions](/sql/common-table-expressions).
