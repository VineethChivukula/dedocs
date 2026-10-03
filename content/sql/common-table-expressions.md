# Common table expressions

## Overview

A common table expression is a temporary, named result set that exists for one
SQL statement. Define one with the `WITH` clause, then reference it
from the statement that follows.

Common table expressions, nested queries, and temporary tables all help
organize intermediate results, but they have different scopes and
capabilities. This guide focuses on non-recursive common table expressions and
compares them with nested queries and temporary tables.

## Non-recursive common table expressions

A non-recursive common table expression has this form:

```sql
WITH cte_name AS (
  SELECT
    column1,
    column2
  FROM source_table
)
SELECT
  column1,
  column2
FROM cte_name;
```

The common table expression definition appears at the beginning of a
`SELECT`, `INSERT`, `UPDATE`, or `DELETE` statement. The main statement and
other definitions in the same `WITH` clause can reference it.

### Scope and lifetime

A common table expression exists only while its statement runs. The database
discards the result after the statement completes. You can't reference it from
a later, independent statement.

### Readability and composition

Common table expressions let you name intermediate steps and read a
transformation from top to bottom. You can define multiple expressions in one
`WITH` clause, and a later expression can reference an earlier one:

```sql
WITH department_totals AS (
  SELECT
    DepartmentID,
    SUM(OrderAmount) AS TotalSales
  FROM Orders
  GROUP BY DepartmentID
),
large_departments AS (
  SELECT
    DepartmentID,
    TotalSales
  FROM department_totals
  WHERE TotalSales > 100000
)
SELECT
  DepartmentID,
  TotalSales
FROM large_departments;
```

Use descriptive names that explain the result or transformation. Avoid
creating a long chain of expressions when a shorter query would be clearer.

## Nested queries

A nested query is a query inside another SQL statement. You can use one in a
`FROM`, `WHERE`, `HAVING`, or `SELECT` clause.

For example, this nested query creates an inline result for the outer query:

```sql
SELECT
  d.DepartmentName,
  totals.TotalSales
FROM Departments AS d
JOIN (
  SELECT
    DepartmentID,
    SUM(OrderAmount) AS TotalSales
  FROM Orders
  GROUP BY DepartmentID
  HAVING SUM(OrderAmount) > 100000
) AS totals
  ON d.DepartmentID = totals.DepartmentID;
```

Nested queries are local to the clause or expression where they appear. They
can be independent of the outer query or correlated with it. Deeply nested
queries can become difficult to read, especially when the same logic appears
in several places.

Use a nested query when the intermediate result is short, local to one part
of the statement, and unlikely to need a separate name.

## Temporary tables

A temporary table is a table stored in a database-managed temporary
workspace. Create one with syntax that depends on the database engine:

```sql
CREATE TEMPORARY TABLE TempDepartmentSales AS
SELECT
  DepartmentID,
  SUM(OrderAmount) AS TotalSales
FROM Orders
GROUP BY DepartmentID;
```

Multiple statements can usually reference temporary tables during
their session or transaction scope. The exact lifetime depends on the
database engine and table definition. A temporary table might disappear when
the session ends, when a transaction commits, or when you explicitly drop it.

Because a temporary table is a physical relation, many database engines let
you:

- Create indexes on it.
- Collect or update statistics.
- Use it across several statements.
- Inspect or transform its contents between steps.

Use a temporary table when an intermediate result is large, needs indexes or
statistics, or several statements must use it.

## Compare the approaches

| Characteristic | Common table expression | Nested query | Temporary table |
| --- | --- | --- | --- |
| Lifetime | One statement. | One clause or expression. | Engine-defined session or transaction scope. |
| Reuse across statements | No. | No. | Usually yes. |
| Readability | Often high for multi-step logic. | Good for small local logic. | Requires multiple statements. |
| Direct indexing | No. | No. | Usually yes. |
| Standalone statistics | No. | No. | Often yes. |
| Storage and materialization | Engine-dependent. | Engine-dependent. | Materialized storage. |
| Cleanup | Automatic after the statement. | Automatic after the statement. | Automatic or explicit, depending on the engine. |

This table describes common behavior, not a universal implementation rule.
Check your database engine's documentation for materialization, scope,
statistics, and cleanup behavior.

## Performance considerations

### Query-plan integration

The optimizer can often combine a nested query or non-recursive common table
expression with the surrounding query plan. This can allow early filtering and join
reordering, and other optimizations.

This behavior is engine-dependent. A common table expression is a query
construct, and the database might materialize or reuse its result.

### Materialized common table expressions

Some database engines support a materialization option for a common table
expression. The database evaluates and stores the result before the
outer query continues.

Materialization can avoid repeated work when several queries use a result. It
can also prevent outer filters from moving into the expression, which can
cause the database to process more rows than necessary. Use this option only
when the execution plan and workload support it.

### Repeated references

When a query references a common table expression more than once, the database
engine might combine its definition, materialize it once, or evaluate parts of it more than once. The
choice depends on the optimizer and the database version.

If repeated evaluation is expensive, compare the expression with a temporary
table.
Measure both versions with an execution plan and representative data.

### Indexes and statistics

Common table expressions and nested queries don't have independent indexes or
statistics. The optimizer estimates their results from the underlying tables
and expressions.

Temporary tables can usually have indexes and statistics. For a large
intermediate result that participates in several joins, an index, or updated
statistics can improve the plan. The benefit depends on the database engine,
data distribution, and query shape.

## Complete example

Suppose you need to find departments whose total sales exceed 100,000,
calculate their average order value, and join the result with department
metadata.

### Use a nested query

```sql
SELECT
  d.DepartmentName,
  totals.TotalSales,
  totals.AvgOrderValue
FROM Departments AS d
JOIN (
  SELECT
    DepartmentID,
    SUM(OrderAmount) AS TotalSales,
    AVG(OrderAmount) AS AvgOrderValue
  FROM Orders
  GROUP BY DepartmentID
  HAVING SUM(OrderAmount) > 100000
) AS totals
  ON d.DepartmentID = totals.DepartmentID;
```

### Use a common table expression

```sql
WITH department_sales AS (
  SELECT
    DepartmentID,
    SUM(OrderAmount) AS TotalSales,
    AVG(OrderAmount) AS AvgOrderValue
  FROM Orders
  GROUP BY DepartmentID
  HAVING SUM(OrderAmount) > 100000
)
SELECT
  d.DepartmentName,
  s.TotalSales,
  s.AvgOrderValue
FROM Departments AS d
JOIN department_sales AS s
  ON d.DepartmentID = s.DepartmentID;
```

The common table expression version gives the intermediate result a name and separates the
aggregation from the final join. Both versions can produce the same execution
plan.

### Use a temporary table

```sql
CREATE TEMPORARY TABLE TempDepartmentSales AS
SELECT
  DepartmentID,
  SUM(OrderAmount) AS TotalSales,
  AVG(OrderAmount) AS AvgOrderValue
FROM Orders
GROUP BY DepartmentID
HAVING SUM(OrderAmount) > 100000;

CREATE INDEX idx_temp_department_sales
  ON TempDepartmentSales (DepartmentID);

SELECT
  d.DepartmentName,
  t.TotalSales,
  t.AvgOrderValue
FROM Departments AS d
JOIN TempDepartmentSales AS t
  ON d.DepartmentID = t.DepartmentID;

DROP TABLE TempDepartmentSales;
```

The temporary-table syntax and index definition vary by database engine.
Explicitly dropping the table makes cleanup clear, even when the engine also
removes it automatically.

## Common pitfalls

### Assuming one evaluation

A common table expression names a query expression, but it doesn't ensure one physical
evaluation. An optimizer might inline it, materialize it, or evaluate its
logic more than once.

Use an execution plan to determine what the database does. Use a temporary
table when you need a materialized result that multiple statements can reuse.

### Forcing materialization without checking filter behavior

Materialization can act as an optimization boundary. For example, the
database might aggregate every department before applying an outer filter for
one department.

Keep restrictive row filters as close as possible to their source tables.
Compare the plan with and without materialization before choosing the option.

### Creating temporary tables in high-frequency code

Creating and dropping temporary tables can require metadata operations and
temporary storage allocation. Repeating those operations in a frequently
called endpoint can add overhead.

Use a common table expression or nested query for small, one-statement transformations. Use a
temporary table when its reuse or indexing benefits justify the setup cost.

### Using stale temporary-table statistics

After populating a large temporary table, the optimizer might have inaccurate
row-count estimates. Depending on the database engine, run the appropriate
statistics command before an important join, such as `ANALYZE`.

Inspect the execution plan to confirm that the optimizer chooses an
appropriate join strategy.

### Leaking temporary tables through connection pools

Connection pools reuse database connections. If a temporary table lasts for
the connection lifetime and code doesn't drop it, a later request can see a
name collision or consume unnecessary temporary storage.

Use unique names where required, drop temporary tables in cleanup code, and
confirm the lifetime rules for the database engine and connection settings.

## Key takeaways

- Use a common table expression to name and organize intermediate logic within one statement.
- Use a nested query for a local intermediate result.
- Use a temporary table when multiple statements need the result or when it
  needs indexes or statistics.
- Don't assume that a common table expression materializes or runs only once.
- Keep filters close to their source data and verify important choices with an
  execution plan.
- Clean up temporary tables explicitly when connection reuse can extend their
  lifetime.
