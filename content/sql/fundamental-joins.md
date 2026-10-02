# Fundamental joins

## Overview

SQL joins combine columns from two or more tables by comparing related
values. Joins let you retrieve related data without storing the same
information in multiple tables.

This guide introduces inner, outer, cross, and self joins. It uses
`Departments` and `Employees` tables to show how each join affects the result.

## Example tables

The examples use the following rows.

### `Departments`

| DepartmentID | DepartmentName |
| --- | --- |
| 10 | Sales |
| 20 | Engineering |
| 30 | Marketing |

### `Employees`

| EmployeeID | Name | DepartmentID | ManagerID |
| --- | --- | --- | --- |
| 101 | Alice | 10 | `NULL` |
| 102 | Bob | 20 | 101 |
| 103 | Charlie | 20 | 101 |
| 104 | Diana | `NULL` | 102 |

The `DepartmentID` column relates an employee to a department. The `ManagerID`
column relates one employee to another.

## Join types

### `INNER JOIN`

An inner join returns only rows for which the join condition matches in both
tables. The query omits rows without a match.

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
INNER JOIN Employees AS e
  ON d.DepartmentID = e.DepartmentID;
```

| DepartmentName | Name |
| --- | --- |
| Sales | Alice |
| Engineering | Bob |
| Engineering | Charlie |

Marketing has no matching employee, and Diana has no department, so the query
excludes both rows.

### `LEFT JOIN`

A left join returns every row from the left table and the matching rows from
the right table. When no right-side row matches, the database returns `NULL`
for the right-side columns.

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
LEFT JOIN Employees AS e
  ON d.DepartmentID = e.DepartmentID;
```

| DepartmentName | Name |
| --- | --- |
| Sales | Alice |
| Engineering | Bob |
| Engineering | Charlie |
| Marketing | `NULL` |

Use a left join when the left-side records must remain in the result, even if
they have no related record.

### `RIGHT JOIN`

A right join returns every row from the right table and matching rows from the
left table. When no left-side row matches, the database returns `NULL` for the
left-side columns.

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
RIGHT JOIN Employees AS e
  ON d.DepartmentID = e.DepartmentID;
```

| DepartmentName | Name |
| --- | --- |
| Sales | Alice |
| Engineering | Bob |
| Engineering | Charlie |
| `NULL` | Diana |

You can usually rewrite a right join as a left join by reversing the table
order. Many teams prefer left joins because they make the preserved table
clearer when reading a query.

### `FULL OUTER JOIN`

A full outer join returns every row from both tables. Matching rows combine
into one result row. For rows without a match, the columns from the other
table contain `NULL`.

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
FULL OUTER JOIN Employees AS e
  ON d.DepartmentID = e.DepartmentID;
```

| DepartmentName | Name |
| --- | --- |
| Sales | Alice |
| Engineering | Bob |
| Engineering | Charlie |
| Marketing | `NULL` |
| `NULL` | Diana |

Not every database engine supports `FULL OUTER JOIN`. If your engine doesn't
support it, you might need to combine a left join and a right join with
`UNION`, taking care to remove duplicate matches.

### `CROSS JOIN`

A cross join returns the Cartesian product of two tables. It pairs every row
from the first table with every row from the second table. It doesn't use a
join condition.

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
CROSS JOIN Employees AS e;
```

With 3 departments and 4 employees, this query returns 12 rows. Use a cross
join only when you need every possible combination. An accidental cross join
can produce a very large result.

### Self joins

A self join joins a table to itself. Use table aliases to distinguish the two
roles that the table plays.

The following query matches each employee with their manager:

```sql
SELECT
  e.Name AS Employee,
  m.Name AS Manager
FROM Employees AS e
LEFT JOIN Employees AS m
  ON e.ManagerID = m.EmployeeID;
```

| Employee | Manager |
| --- | --- |
| Alice | `NULL` |
| Bob | Alice |
| Charlie | Alice |
| Diana | Bob |

The left join keeps Alice in the result even though she has no manager.

## How join conditions work

The `ON` clause defines how the database matches rows. An equality condition,
such as `d.DepartmentID = e.DepartmentID`, is an equi-join condition.
The database compares the values and combines rows when the condition is
`TRUE`.

`NULL` doesn't equal `NULL`. A comparison with `NULL` evaluates to
`UNKNOWN`, not `TRUE`. As a result, rows with `NULL` join keys don't match
each other in an equality join.

For example, Diana's `NULL` `DepartmentID` doesn't match another `NULL`
`DepartmentID`. A left, right, or full outer join can still include Diana
because those joins preserve unmatched rows.

## Common pitfalls

### Filtering an outer join in `WHERE`

A condition on the right table in the `WHERE` clause can remove the `NULL`
rows that a left join should preserve.

This query returns only departments that have an employee named Alice. The
`WHERE` condition removes departments whose right-side values are `NULL`:

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
LEFT JOIN Employees AS e
  ON d.DepartmentID = e.DepartmentID
WHERE e.Name = 'Alice';
```

To preserve departments without matching employees, move the condition into
the `ON` clause:

```sql
SELECT
  d.DepartmentName,
  e.Name
FROM Departments AS d
LEFT JOIN Employees AS e
  ON d.DepartmentID = e.DepartmentID
 AND e.Name = 'Alice';
```

The first query filters the completed join result. The second query limits
which right-side rows can match while preserving every department.

### Duplicate rows after a join

A join can return multiple rows for one row in either input table. For
example, Engineering appears twice because two employees belong to that
department.

If both sides contain multiple matching rows for the same key, the join
returns one result for every matching pair. This can multiply rows and inflate
aggregates such as `SUM` and `COUNT`.

Before aggregating a joined result, verify the relationship's cardinality:

- One-to-one relationships return at most one match on each side.
- One-to-many relationships return one row for each related child.
- Many-to-many relationships can multiply rows on both sides.

Use `COUNT(DISTINCT ...)`, pre-aggregate one side, or change the query shape
when you need to avoid counting the same entity more than once.

### `NULL` values in join keys

Rows with `NULL` values don't match in an equi-join, even when both join
keys are `NULL`. If `NULL` represents a missing relationship, this behavior
is usually correct.

If the data model requires missing keys to match, define that behavior
explicitly. For example, use a condition that checks both columns:

```sql
ON left_table.KeyValue = right_table.KeyValue
OR (
  left_table.KeyValue IS NULL
  AND right_table.KeyValue IS NULL
)
```

Use this pattern only when treating two missing values as a match is valid for
the app.

### `FULL OUTER JOIN` support

SQL syntax and join support vary by database engine. In particular, some
engines don't implement `FULL OUTER JOIN`. Check the documentation for your
database engine before using dialect-specific syntax.

If necessary, use a combination of `LEFT JOIN`, `RIGHT JOIN`, and `UNION` to
produce the equivalent result. Test the replacement carefully because
duplicate matching rows can appear when you combine result sets.

## Key takeaways

- Use `INNER JOIN` when you need only matching rows.
- Use `LEFT JOIN` or `RIGHT JOIN` to preserve rows from one side.
- Use `FULL OUTER JOIN` to preserve unmatched rows from both sides when the
  database engine supports it.
- Use `CROSS JOIN` only when you need every possible row combination.
- Use a self join to relate rows within the same table.
- Put outer-join filters in the correct clause to preserve unmatched rows.
- Check join cardinality before aggregating results.
- Remember that `NULL` values don't match in equality joins.
