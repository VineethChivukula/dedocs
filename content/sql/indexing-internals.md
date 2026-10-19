# Database indexing internals

## Overview

An index is an auxiliary data structure that helps a database locate rows
without scanning every row in a table. An index stores key values and
references to corresponding table data pages.

Indexes can improve point searches, joins, sorting, and range queries. They also
require storage and maintenance when the database inserts, updates, or
deletes rows. The appropriate index depends on the database engine, workload, data
distribution, and query predicates.

This guide details index internal structures, access patterns, and maintenance
tradeoffs using the Stanford University student academic database.

## B-tree indexes

A B-tree is a balanced, multi-way search tree that stores keys in sorted order.
Database engines organize the tree into pages so that one page read can
process several keys. The tree remains balanced as rows change.

An abstract B-tree looks like this:

```mermaid
flowchart TD
    Root["Root Page: Internal Node<br/>[ P0 | Key 100 (Data) | P1 | Key 300 (Data) | P2 ]"]

    Leaf1["Leaf Page 1<br/>Keys 10 .. 99 (Data)"]
    Leaf2["Leaf Page 2<br/>Keys 101 .. 299 (Data)"]
    Leaf3["Leaf Page 3<br/>Keys 301 .. 500 (Data)"]

    Root -->|"P0: Keys 10 .. 99"| Leaf1
    Root -->|"P1: Keys 101 .. 299"| Leaf2
    Root -->|"P2: Keys 301 .. 500"| Leaf3
```

In a B-tree page:

- Pointer P0 precedes Key 100 and points to child records with keys less than 100.
- Key 100 stores the key and its corresponding table row data directly in the root page. If a point lookup searches for `Key = 100`, the search terminates immediately at the root without descending to a leaf.
- Pointer P1 sits between Key 100 and Key 300, pointing to child records with keys strictly between them.
- Key 300 stores the key and its row data directly in the root page.
- Pointer P2 follows Key 300 and points to child records with keys greater than 300.

Because leaf pages in a standard B-tree aren't linked to each other, range
queries require an in-order traversal that navigates up and down tree levels.

B-trees support common predicates such as:

- Equality, such as `student_id = 1001`.
- Ranges, such as `admission_date >= '2026-01-01'`.
- Prefix searches, such as `email LIKE 'david%'`, when the collation and index
  support the pattern.
- Ordered scans and joins on indexed columns.

Page size, tree layout, and the exact implementation depend on the database
engine.

## B+ tree indexes

A B+ tree is a related tree structure that stores search keys in internal pages
and stores row references or data in leaf pages. The engine links leaf pages
in key order, which supports sequential range scans.

```mermaid
flowchart TD
    Root["Root Page: Internal Router<br/>[ P0 | Key 100 | P1 | Key 300 | P2 ]"]

    subgraph LeafLevel ["Leaf Pages: linked for sequential range scans"]
        direction LR
        Leaf1["Leaf Page 1<br/>Keys 10 .. 100 (Data)"]
        Leaf2["Leaf Page 2<br/>Keys 101 .. 300 (Data)"]
        Leaf3["Leaf Page 3<br/>Keys 301 .. 500 (Data)"]

        Leaf1 <===>|"Sequential scan"| Leaf2
        Leaf2 <===>|"Sequential scan"| Leaf3
    end

    Root -->|"P0: Keys 10 .. 100"| Leaf1
    Root -->|"P1: Keys 101 .. 300"| Leaf2
    Root -->|"P2: Keys 301 .. 500"| Leaf3
```

Many relational database engines use a B+ tree or a similar balanced-tree
structure for general-purpose indexes. The exact default differs by engine,
storage engine, and index type. Check the engine documentation before relying
on a particular implementation.

## Hash indexes

A hash index maps a key to a bucket using a hash function:

```mermaid
graph LR
    subgraph Inputs ["1. Search Key"]
        Key["Key: 'David'"]
    end

    subgraph Engine ["2. Hash Function"]
        HF["h(Key) = hash mod N<br/>h('David') = 2"]
    end

    subgraph Directory ["3. Bucket Directory"]
        direction TB
        B0["Bucket 0"]
        B1["Bucket 1"]
        B2["Bucket 2"]
        B3["Bucket 3"]
    end

    subgraph Buckets ["4. Data Blocks"]
        direction TB
        Page0["Page 0: Marcus | Pointer 0x12"]
        Page2["Page 2: David | Pointer 0x4B<br/>Andrea | Pointer 0x8F"]
    end

    Key --> HF
    HF --> B2
    B2 --> Page2
    B0 --> Page0
```

Hash indexes primarily support equality predicates, such as
`email = 'david.clark@stanford.edu'`. They generally don't support ordered range
scans in the same way as a B-tree.

Hash-index support, durability, collision handling, and optimizer behavior
vary by database engine. Use a hash index only when its equality-lookup
benefit matches the workload and the engine supports it effectively.

## Bitmap indexes

A bitmap index represents each distinct value with a bit vector. Each bit
corresponds to a row in the relation:

```mermaid
flowchart TD
    subgraph Data ["1. Indexed student records"]
        direction TB
        R1["Row 1: Undergraduate | Resident"]
        R2["Row 2: Graduate | Commuter"]
        R3["Row 3: Undergraduate | Commuter"]
        R4["Row 4: Graduate | Resident"]
    end

    subgraph Indexes ["2. Bitmap indexes"]
        subgraph LevelIdx ["Academic level index"]
            direction TB
            BM_U["Key: Undergraduate: 1 0 1 0"]
            BM_G["Key: Graduate: 0 1 0 1"]
        end

        subgraph StatusIdx ["Residency status index"]
            direction TB
            BM_R["Key: Resident: 1 0 0 1"]
            BM_C["Key: Commuter: 0 1 1 0"]
        end
    end

    subgraph Query ["3. Query: Undergraduate AND Commuter"]
        direction TB
        Q1["Undergraduate bit vector: 1 0 1 0"]
        Q2["Commuter bit vector:      0 1 1 0"]
        Q3["Bitwise AND result:       0 0 1 0"]
        Q4["Matched result: Row 3"]
    end

    Data --> Indexes
    Indexes --> Query
```

Bitmap indexes work well for columns with few distinct values and workloads
that read many rows, such as analytical queries. Bit operations can
combine multiple conditions efficiently.

Frequent writes can make bitmap indexes expensive to maintain or lock,
depending on the database engine. They're often less suitable for highly
concurrent transactional workloads.

## Clustered and secondary indexes

### Clustered indexes

A clustered index determines how a table stores its rows or how the table data
relates to the index's leaf pages. Because the table data follows the
clustered order, a range scan can read nearby rows efficiently.

A table can usually have only one clustered organization because its rows can
follow only one physical or logical order. Some engines don't support
clustered indexes, and others implement them through the primary key or a
clustered-table structure.

Choose a clustered key that supports common range access and remains stable.
Frequent changes to a wide or randomly distributed clustered key can increase
page splits and maintenance work.

### Non-clustered or secondary indexes

A non-clustered index stores indexed keys separately from the table data. Its
leaf entries contain a row identifier, a primary-key value, or another
reference that lets the database find the base row.

Secondary indexes can support additional filters, joins, and sort orders.
When a query uses a secondary index, the database might need extra row fetches to
retrieve columns that the index doesn't contain.

In this guide, **secondary index** refers to an index separate from the table's
primary storage organization.

### Covering indexes

A covering index contains every column that a query needs. The database can
answer the query from the index without fetching the base table row:

```sql
CREATE INDEX idx_students_major_admission
  ON students (major_name)
  INCLUDE (admission_date);
```

The `INCLUDE` syntax is engine-specific. An equivalent index might place all
required columns in its key, although that can increase the size and
maintenance cost of the key.

Covering indexes can reduce base-row fetches, but they use additional storage
and increase write work. Create them for measured, important query patterns
rather than for every possible column combination.

## Comparison of index types

| Index type | Main layout | Equality lookup | Range access | Typical use |
| :--- | :--- | :--- | :--- | :--- |
| B-tree or B+ tree | Balanced sorted tree | Supported | Supported | General transactional queries |
| Hash | Hash buckets | Supported | Not the primary use | Exact equality searches |
| Bitmap | Bit vectors for distinct values | Supported through bit operations | Engine-dependent | Low-cardinality analytical queries |
| Clustered | Table rows follow index order | Supported | Efficient for nearby rows | Primary storage order and range access |
| Secondary | Keys and row references separate from storage | Supported | Depends on key order | Additional filters, joins, and sort orders |
| Covering | Secondary index contains requested payload columns | Supported | Depends on key order | Avoiding base-row fetches |

This table describes common properties. Always verify the implementation and
optimizer behavior for your database engine.

## Complete example

The following schema illustrates a primary key, a unique secondary index, and
a covering index:

```sql
CREATE TABLE students (
  student_id     INTEGER PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  major_name     VARCHAR(50) NOT NULL,
  admission_date DATE NOT NULL
);

CREATE UNIQUE INDEX idx_students_email
  ON students (email);

CREATE INDEX idx_students_major_admission
  ON students (major_name)
  INCLUDE (admission_date);
```

### Point lookup by primary key

```sql
SELECT
  student_id,
  email,
  major_name,
  admission_date
FROM students
WHERE student_id = 1001;
```

The optimizer can use the primary-key index to locate the record directly.

### Point lookup by email

```sql
SELECT
  student_id,
  email,
  major_name,
  admission_date
FROM students
WHERE email = 'david.clark@stanford.edu';
```

The unique email index locates at most one matching record. The database uses
the index to find the row pointer and then fetches non-indexed columns from the
base table.

### Covered lookup by major

```sql
SELECT admission_date
FROM students
WHERE major_name = 'Computer Science';
```

The major index includes both the filter key and `admission_date`, so the engine
answers this query directly from index pages without fetching base table rows.

Use `EXPLAIN`, `EXPLAIN ANALYZE`, or the engine's equivalent plan tool to
verify which index the database chooses.

## Index maintenance and performance

An index improves read throughput but adds work to writes. For an insert, update,
or delete, the database must update every affected index, split pages, and
maintain index statistics.

Consider these operational factors:

- Indexes reduce the number of rows or pages that a query reads, accelerating lookup queries.
- Each additional index introduces write overhead during inserts, updates, and deletes.
- Secondary indexes consume additional disk storage and buffer pool memory.
- The query optimizer relies on index statistics to estimate selectivity and construct execution plans.
- Indexes provide greater benefit when a predicate is selective and excludes a large portion of the table.
- For a composite index, the order of leading columns determines which query predicates and sort orders can use the index.

Don't rely on a fixed selectivity threshold such as 15% or 20%. The useful
threshold depends on table size, data distribution, caching, storage costs,
and the query plan.

## Common pitfalls

### Too many indexes

Every additional index can increase insert, update, and delete costs. It can
also consume storage and create overlapping indexes that provide little
benefit.

Review index usage and query plans regularly. Remove redundant indexes only
after confirming that no important query depends on them.

### Poor clustered-key choice

A clustered key that changes frequently or inserts random values can cause
page splits and fragmented storage. A wide key also increases the size of
secondary indexes on engines that store the clustered key in secondary
entries.

Choose a stable, appropriately sized key, and validate the write pattern with
the database engine's monitoring tools.

### Low-selectivity predicates

An index on a column with few distinct values might not reduce the work enough
to justify random row fetches. The optimizer might choose a table scan instead.

Don't assume that an index is useful for every predicate. Compare the plan
with representative data.

### Bitmap indexes in write-heavy workloads

Bitmap indexes can be effective for analytical reads, but concurrent writes
can require more maintenance or locking. Confirm the engine's bitmap-index
behavior before using one on a frequently updated table.

### Covering indexes with excessive payload columns

Adding many included columns can make a covering index large and expensive to
maintain. Include only the columns that remove a measured, important base-row
lookup.

### Assuming the engine uses an index

The optimizer can choose a different access path because of statistics,
selectivity, data volume, or query shape. The engine might choose a sequential
scan instead of the declared index.

Use an execution plan and current statistics to verify the access path.

## Key takeaways

- Use balanced-tree indexes for general equality and range access.
- Use hash indexes primarily for equality searches when the engine supports
  them effectively.
- Use bitmap indexes for suitable low-cardinality analytical workloads.
- Choose clustered keys carefully because they affect table organization and
  secondary indexes.
- Use covering indexes selectively to avoid base-row fetches.
- Balance read improvements against write, storage, and maintenance costs.
- Verify index choices with execution plans and representative data.

## What's next

- Learn how database query planners evaluate index costs and generate plans in
  [Query execution engine](/sql/query-execution-engine).
- Master predicate push-down, nested loops, and hash join optimization in
  [Advanced query optimization](/sql/advanced-query-optimization).
- Review page storage, buffer frames, and write-ahead logging in
  [Database storage engine internals](/sql/database-storage-engine-internals).
