# Recursive queries and graph traversals

## Overview

Recursive queries navigate hierarchical or graph-shaped data when the number
of relationship levels isn't known in advance. A recursive common table
expression repeatedly follows relationships until it reaches a stopping
condition.

Use recursive queries for organizational hierarchies, bill-of-materials
explosions, dependency graphs, and other adjacency-list data. This guide
explains the structure of a recursive common table expression and shows how to prevent cycles.

## Recursive query structure

A recursive common table expression has two query parts:

1. The **anchor member** returns the starting rows.
2. The **recursive member** follows relationships from the rows found in the
   previous iteration.

The parts are usually combined with `UNION ALL`:

```sql
WITH RECURSIVE hierarchy AS (
  -- Anchor member
  SELECT
    EmployeeID,
    ManagerID,
    0 AS Depth
  FROM Employees
  WHERE ManagerID IS NULL

  UNION ALL

  -- Recursive member
  SELECT
    e.EmployeeID,
    e.ManagerID,
    h.Depth + 1
  FROM Employees AS e
  JOIN hierarchy AS h
    ON e.ManagerID = h.EmployeeID
)
SELECT
  EmployeeID,
  ManagerID,
  Depth
FROM hierarchy;
```

The database evaluates the anchor member first. It then evaluates the
recursive member using rows produced by the previous iteration and appends
new rows to the result. Recursion stops when an iteration produces no new
rows or when the database reaches a configured recursion limit.

The exact syntax varies by database engine. Some engines require `RECURSIVE`
after `WITH`, while others use `WITH` alone or provide a different recursion
syntax.

### Column alignment

The anchor and recursive members must return the same number of columns in the
same order. Corresponding columns must have compatible data types.

If a column changes type during recursion, cast both members to a common type:

```sql
WITH RECURSIVE paths AS (
  SELECT
    NodeID,
    CAST(NodeID AS VARCHAR(500)) AS Path
  FROM Nodes
  WHERE ParentID IS NULL

  UNION ALL

  SELECT
    child.NodeID,
    CAST(paths.Path || '/' || child.NodeID AS VARCHAR(500))
  FROM Nodes AS child
  JOIN paths
    ON child.ParentID = paths.NodeID
)
SELECT NodeID, Path
FROM paths;
```

Use the concatenation and cast syntax supported by your database engine.

## Hierarchies and trees

An adjacency list represents a hierarchy with a parent reference. For
example, an `Employees.ManagerID` column can reference `Employees.EmployeeID`.
The relationship forms a tree when each node has at most one parent and the
data contains no cycles.

Recursive queries can:

- Find all descendants of a manager.
- Find the path from a node to its root.
- Calculate the depth of each node.
- Build a display path such as `Company / Sales / West`.
- Aggregate values across a branch of the hierarchy.

For example, this query returns all reports under manager 101:

```sql
WITH RECURSIVE reports AS (
  SELECT
    EmployeeID,
    Name,
    ManagerID,
    0 AS Depth
  FROM Employees
  WHERE EmployeeID = 101

  UNION ALL

  SELECT
    e.EmployeeID,
    e.Name,
    e.ManagerID,
    r.Depth + 1
  FROM Employees AS e
  JOIN reports AS r
    ON e.ManagerID = r.EmployeeID
)
SELECT
  EmployeeID,
  Name,
  ManagerID,
  Depth
FROM reports
WHERE Depth > 0;
```

## Bill-of-materials explosions

A bill of materials describes how a finished product consists of
sub-assemblies, components, and raw materials. A recursive query can expand
the complete parts list for an assembly.

If a parent requires a quantity of a component, multiply quantities as the
query moves down the hierarchy. For example, if assembly 100 requires 2 units
of part 200 and part 200 requires 4 units of part 300, assembly 100 requires
8 units of part 300.

Track the following values when expanding a bill of materials:

- Current parent and component identifiers.
- Total quantity required along the path.
- Depth in the component hierarchy.
- The path of visited components.
- A cycle flag or other stopping condition.

## Cycle detection

Graphs can contain cycles, such as `A -> B -> C -> A`. Without cycle
detection or a recursion limit, a recursive query can continue indefinitely or
generate an unexpectedly large result.

Common cycle-prevention strategies include:

- Store the visited identifiers in a path and stop when the next identifier
  already appears.
- Maintain a visited-node table when the database engine supports that
  pattern.
- Use a database-specific cycle-detection clause.
- Set a maximum depth as a safety limit.

A maximum depth limits damage but doesn't identify the invalid relationship.
Use path tracking or an engine feature when you need to report the cycle.

## Complete example

The following example expands the components of assembly 100. It multiplies
quantities, tracks depth and path, and marks a repeated component.

```sql
CREATE TABLE BillOfMaterials (
  ParentPartID INTEGER,
  ComponentPartID INTEGER,
  Quantity INTEGER NOT NULL,
  PRIMARY KEY (ParentPartID, ComponentPartID)
);

INSERT INTO BillOfMaterials (
  ParentPartID,
  ComponentPartID,
  Quantity
) VALUES
  (100, 200, 2),
  (100, 201, 1),
  (200, 300, 4),
  (201, 300, 2),
  (300, 100, 1);

WITH RECURSIVE PartsExplosion AS (
  SELECT
    ParentPartID,
    ComponentPartID,
    Quantity AS TotalQuantity,
    1 AS Depth,
    CAST(
      '/' || ParentPartID || '/' || ComponentPartID || '/'
      AS VARCHAR(500)
    ) AS PathHistory,
    0 AS IsCycle
  FROM BillOfMaterials
  WHERE ParentPartID = 100

  UNION ALL

  SELECT
    bom.ParentPartID,
    bom.ComponentPartID,
    pe.TotalQuantity * bom.Quantity AS TotalQuantity,
    pe.Depth + 1 AS Depth,
    CAST(
      pe.PathHistory || bom.ComponentPartID || '/'
      AS VARCHAR(500)
    ) AS PathHistory,
    CASE
      WHEN pe.PathHistory LIKE '%/' || bom.ComponentPartID || '/%' THEN 1
      ELSE 0
    END AS IsCycle
  FROM PartsExplosion AS pe
  JOIN BillOfMaterials AS bom
    ON pe.ComponentPartID = bom.ParentPartID
  WHERE pe.IsCycle = 0
)
SELECT
  ParentPartID,
  ComponentPartID,
  TotalQuantity,
  Depth,
  PathHistory,
  IsCycle
FROM PartsExplosion;
```

The row `(300, 100, 1)` creates a cycle back to component 100. The path
check marks that row with `IsCycle = 1`, and the `WHERE pe.IsCycle = 0`
condition prevents the query from expanding that branch again.

This example uses string concatenation and `LIKE` for path tracking. For large
graphs or identifiers that can overlap as text, use a database-supported array,
JSON, or visited-set representation instead.

## Common pitfalls

### Infinite recursion

A cycle, an incorrect join condition, or a missing stopping condition can
cause recursion to continue until the engine reaches its recursion limit.

Use a cycle check, a maximum depth, or both. Treat a recursion-limit error as a
data or query problem to investigate, not as proof that the hierarchy is
valid.

### Data type mismatches

The anchor and recursive members must return compatible types. String paths
are a common source of errors because concatenation can produce a type or
length different from the anchor expression.

Cast both expressions to a suitable type and length. Increase the path
capacity when the maximum traversal depth or identifier length requires it.

### Row explosion

Branching graphs can produce many paths. A node can appear once for every
distinct path that reaches it, so the number of rows can grow rapidly with
depth and branching factor.

Filter the anchor rows, restrict the recursive join, enforce a depth limit,
and index the parent-reference column. Aggregate or remove duplicates only when
doing so matches the meaning of the result.

### `UNION` and `UNION ALL`

Recursive common table expressions commonly use `UNION ALL` because it preserves every generated
path and lets the query apply its own cycle logic. Replacing it with `UNION`
can remove duplicate rows, but it can also hide meaningful paths and change
the traversal behavior.

Use the operator required by the database engine and the result you need. Do
not use duplicate removal as a substitute for cycle detection.

### Using relational recursion for every graph problem

Recursive SQL can traverse many graph structures, but complex graph
algorithms can become difficult to express and tune. Large, highly connected
graphs may need specialized graph features or a graph database.

Choose the approach based on graph size, traversal depth, query frequency,
required algorithms, and the database features available to you.

## Key takeaways

- Use a recursive common table expression for variable-depth hierarchies and
  graph traversals.
- Define an anchor member and a recursive member with aligned columns.
- Track depth, paths, or visited nodes to control traversal.
- Detect cycles explicitly instead of relying only on recursion limits.
- Expect row counts to grow quickly in branching graphs.
- Index relationship columns and constrain recursion for large data sets.
- Verify recursive syntax, limits, and cycle features for your database engine.
