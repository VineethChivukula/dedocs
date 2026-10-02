<!-- vale off -->

# Data engineering micro syllabus

The micro syllabus is designed to provide a structured learning path for aspiring data engineers.

## Topics covered

| Unit | Content/topics covered                                                                                                      | Text book | Chapter / section no. | Page number |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------- | ----------- |
| I    | Relational Model Concepts: Tables, Rows, Columns, Primary Keys, Foreign Keys, Unique Constraints, NOT NULL                  | [T5]      | 1                     | 1–14        |
| I    | Basic Querying & Filtering: SELECT, WHERE, AND/OR/NOT, BETWEEN, IN, LIKE pattern matching                                   | [T5]      | 1                     | 15–28       |
| I    | Basic Aggregations & Grouping: COUNT(), SUM(), AVG(), MIN(), MAX(), GROUP BY, HAVING clause mechanics                       | [T5]      | 2                     | 30–45       |
| I    | Fundamental Joins: Inner Joins, Left Outer, Right Outer, Full Outer, Cross Joins, Self Joins                                | [T5]      | 4                     | 120–135     |
| I    | Conditional Logic & NULL Handling: CASE WHEN, COALESCE(), NULLIF(), Three-Valued Logic (TRUE, FALSE, UNKNOWN)               | [T5]      | 3                     | 80–95       |
| I    | Subqueries & Set Operations: Scalar Subqueries, Correlated Subqueries, EXISTS vs IN, UNION, UNION ALL, INTERSECT, EXCEPT    | [T5]      | 4                     | 136–150     |
| I    | Analytical & Window Functions: OVER(), PARTITION BY, ORDER BY, ROW_NUMBER(), RANK(), DENSE_RANK(), NTILE()                  | [T5]      | 12                    | 340–355     |
| I    | Value & Frame Navigation: LEAD(), LAG(), FIRST_VALUE(), LAST_VALUE(), Window Frames (ROWS/RANGE PRECEDING/FOLLOWING)        | [T5]      | 12                    | 356–370     |
| I    | Common Table Expressions (CTEs): Non-recursive CTEs vs. Temporary Tables vs. Subquery performance tradeoffs                 | [T5]      | 14                    | 400–410     |
| I    | Recursive Queries & Graph Traversals: Recursive CTEs for organizational hierarchies, bill-of-materials, cycle detection     | [T5]      | 14                    | 411–425     |
| I    | Multidimensional Aggregation: ROLLUP, CUBE, GROUPING SETS, and GROUPING() function                                          | [T5]      | 10                    | 280–295     |
| I    | Database Storage Engine Internals: Page storage, Heap files, Slotted pages, Buffer Pools, Write-Ahead Logging (WAL)         | [T2]      | 3                     | 70–76       |
| I    | Indexing Internals: B-Trees, B+ Trees, Hash Indexes, Bitmap Indexes, Clustered vs Non-Clustered Indexes                     | [T2]      | 3                     | 79–84       |
| I    | Query Execution Engine: Order of execution (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY), EXPLAIN plans            | [T2]      | 3                     | 96–110      |
| I    | Advanced Query Optimization: Predicate pushdown, Index scanning vs Sequential scans, Nested Loop vs Hash Join vs Merge Join | [T2]      | 3                     | 111–125     |
| II   | Fundamentals of Data Modeling: Conceptual, Logical, Physical Data Models, Entity-Relationship (ER) Diagrams                 | [T1]      | 1                     | 1–15        |
| II   | Entities, Attributes & Relationships: 1:1, 1:N, M:N entity relationships and Junction/Bridge tables                         | [T1]      | 1                     | 16–25       |
| II   | Database Normalization Mechanics: Insertion, Deletion, Update Anomalies, 1NF, 2NF, 3NF, BCNF, Denormalization               | [T5]      | App. A                | 500–515     |
| II   | Dimensional Modeling Methodology: Kimball Dimensional Modeling vs. Inmon Enterprise Data Warehouse (EDW) top-down           | [T1]      | 1                     | 26–35       |
| II   | Schema Architectures: Star Schema vs. Snowflake Schema vs. Wide Denormalized Tables (Performance vs Storage)                | [T1]      | 2                     | 40–48       |
| II   | Fact Table Design & Types: Transaction Fact Tables, Periodic Snapshot Facts, Accumulating Snapshot Facts                    | [T1]      | 1                     | 36–45       |
| II   | Specialized Fact Designs: Factless Fact Tables, Header/Line-Item Fact Models, Grain definition consistency                  | [T1]      | 3                     | 90–95       |
| II   | Dimension Design Patterns: Conformed Dimensions, Role-Playing Dimensions, Outrigger Dimensions, Junk Dimensions             | [T1]      | 2                     | 36–49       |
| II   | Primary & Key Management: Natural/Business Keys vs. Surrogate Keys vs. Hash Keys (MD5/SHA256) in modern DW                  | [T1]      | 3                     | 76–85       |
| II   | Slowly Changing Dimensions (SCD) Core: Type 0 (Retain), Type 1 (Overwrite), Type 2 (History tracking with dates/flags)      | [T1]      | 2                     | 50–60       |
| II   | Advanced SCD Patterns: Type 3 (Previous column), Type 4 (History table), Type 6 (Hybrid 1+2+3)                              | [T1]      | 2                     | 61–75       |
| II   | Modern Lakehouse Architecture: Data Warehouse vs. Data Lake vs. Lakehouse (Delta Lake, Apache Iceberg, Apache Hudi)         | [T7]      | 4                     | 100–120     |
| III  | Distributed Computing Basics: Horizontal vs. Vertical Scaling, Shared-Nothing Architecture, Cluster Computing               | [T3]      | 1                     | 3–10        |
| III  | Spark Core Architecture: Driver Process, Cluster Manager (YARN/K8s), Worker Nodes, Executors, and Tasks                     | [T3]      | 2                     | 13–25       |
| III  | PySpark Abstractions: RDDs vs. DataFrames vs. Datasets, Immutability, Lazy Evaluation, Lineage Graphs                       | [T3]      | 3                     | 27–35       |
| III  | Basic DataFrame Operations: select(), filter(), withColumn(), groupBy(), agg(), orderBy(), dropDuplicates()                 | [T3]      | 3                     | 36–44       |
| III  | Spark Transformations & Actions: Narrow Transformations (map, filter) vs. Wide Transformations (groupBy, join)              | [T3]      | 5                     | 63–80       |
| III  | Catalyst Optimizer Internals: Unresolved Logical Plan → Logical Plan → Physical Plan → Whole-Stage Code Gen                 | [T3]      | 4                     | 45–55       |
| III  | Tungsten Execution Engine: Off-heap memory management, cache-aware memory layout, binary encoding                           | [T3]      | 4                     | 56–62       |
| III  | File Formats & Compression: Parquet (columnar, row groups, dictionary encoding), Avro (row-based, schema evolution), ORC    | [T3]      | 19                    | 320–335     |
| III  | Distributed Join Strategies: Broadcast Hash Join (BHJ), Shuffle Hash Join (SHJ), Sort-Merge Join (SMJ)                      | [T3]      | 8                     | 130–145     |
| III  | Shuffling & Partitioning: Default parallelism, Hash Partitioning, Range Partitioning, coalesce() vs repartition()           | [T3]      | 16                    | 270–285     |
| III  | Memory Allocation & Tuning: Storage Memory vs Execution Memory fractions, Handling OOM errors (Driver vs Executor)          | [T3]      | 15                    | 250–265     |
| III  | Data Skew Mitigation: Identifying skewed keys, Salting techniques (random key prefixing), AQE (Adaptive Query Execution)    | [T3]      | 17                    | 286–305     |
| III  | Caching, Persisting & Checkpointing: Storage levels (MEMORY_ONLY, MEMORY_AND_DISK), eviction, Checkpointing to S3/HDFS      | [T3]      | 17                    | 306–315     |
| IV   | Pipeline Paradigms & Ingestion: ETL vs. ELT, Batch vs Streaming ingestion, REST APIs, CDC (Change Data Capture)             | [T7]      | 5                     | 130–150     |
| IV   | Python Data Wrangling Scripting: Generators for memory efficiency, Iterators, Log File Parsing, JSON manipulation           | [T4]      | 11                    | 160–175     |
| IV   | Data Pipeline Architecture: Medallion Architecture (Bronze: Raw Ingestion, Silver: Cleaned, Gold: Business Marts)           | [T7]      | 6                     | 165–185     |
| IV   | Workflow Orchestration (Apache Airflow): DAGs, Operators, Tasks, Dependencies, Airflow Architecture                         | [T6]      | 3                     | 75–85       |
| IV   | Orchestration Best Practices: Idempotency, Backfilling historical data, Catchup, Retries, SLAs, Airflow Sensors, XComs      | [T6]      | 3                     | 86–95       |
| IV   | Event-Driven & Streaming Messaging: Apache Kafka (Topics, Partitions, Offsets, Consumer Groups, Retention)                  | [T2]      | 11                    | 439–465     |
| IV   | Stream Processing Semantics & Windows: Event Time vs Processing Time, Watermarking, Tumbling/Hopping/Sliding Windows        | [T2]      | 11                    | 466–480     |
| IV   | Delivery Guarantees: At-least-once, At-most-once, Exactly-once processing (EOS) semantics in Kafka and Spark                | [T2]      | 11                    | 481–495     |
| IV   | Distributed Systems Fundamentals: CAP Theorem, PACELC Theorem, Eventual vs. Strong Consistency Models                       | [T2]      | 1                     | 23–35       |
| IV   | Sharding & Replication Patterns: Range/Hash Sharding, Consistent Hashing, Single/Multi-Leader & Leaderless Replication      | [T2]      | 5                     | 151–215     |
| IV   | Governance, Quality & System Design: Data Lineage, Schema Contracts, Great Expectations, PII Hashing, System Design         | [T6]      | 4                     | 91–110      |
| V    | Complexity Analysis: Time & Space Complexity (Big-O, Big-Omega, Big-Theta), Auxiliary Space analysis                        | [T4]      | VI                    | 38–50       |
| V    | Python Built-in Data Structures: Lists (Dynamic Arrays), Dicts, Sets, Tuples internal complexities & mechanics              | [T4]      | 1                     | 75–87       |
| V    | Arrays & Strings Algorithms: Two-Pointer Technique, Sliding Window Patterns (Fixed/Variable), Hash Map lookups              | [T4]      | 1                     | 88–95       |
| V    | Linked Lists Algorithms: Singly/Doubly Linked Lists, Fast & Slow Pointer (Floyd's Cycle Detection, Middle Element)          | [T4]      | 2                     | 92–95       |
| V    | Stacks & Queues: LIFO/FIFO Mechanics, Monotonic Stacks (Next Greater Element), Deque implementations                        | [T4]      | 3                     | 96–99       |
| V    | Sorting & Searching Algorithms: Quicksort, Merge Sort, Binary Search and boundary variations (Lower/Upper Bound)            | [T4]      | 10                    | 146–155     |
| V    | Trees & Hierarchical Structures: Binary Search Trees (BST), Tree Traversals (BFS, DFS, Level-order), BST Validation         | [T4]      | 4                     | 100–110     |
| V    | Heaps & Priority Queues: Min-Heap / Max-Heap mechanics, Top-K Frequent Problems, Merge K Sorted Lists                       | [T4]      | 4                     | 126–135     |
| V    | Graph Algorithms: Adjacency List/Matrix, BFS, DFS, Topological Sorting (Kahn's Algorithm) for DAG execution ordering        | [T4]      | 4                     | 111–125     |
| V    | Advanced Patterns for DE: Hash Maps & Frequency Buckets, Interval Merging, LRU Cache implementation, Trie                   | [T4]      | 11                    | 176–190     |

## Text books

| Reference | Citation                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [T1]      | Ralph Kimball and Margy Ross, _The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling_, Third Edition, Wiley, 2013. |
| [T2]      | Martin Kleppmann, _Designing Data-Intensive Applications_, First Edition, O'Reilly Media, 2017.                                       |
| [T3]      | Bill Chambers and Matei Zaharia, _Spark: The Definitive Guide_, First Edition, O'Reilly Media, 2018.                                  |
| [T4]      | Gayle Laakmann McDowell, _Cracking the Coding Interview_, Sixth Edition, CareerCup, 2015.                                             |
| [T5]      | Anthony Molinaro, _SQL Cookbook_, Second Edition, O'Reilly Media, 2020.                                                               |
| [T6]      | Alex Xu, _System Design Interview – An Insider's Guide_, Volume 1 & 2, ByteByteGo, 2020.                                              |
| [T7]      | Joe Reis and Matt Housley, _Fundamentals of Data Engineering_, First Edition, O'Reilly Media, 2022.                                   |

## E-resources and other digital material

| Reference | Resource                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| [1]       | [LeetCode Database Problem Set (Top SQL 50 & Hard SQL Patterns)](https://leetcode.com/studyplan/top-sql-50/) |
| [2]       | [LeetCode Algorithms & NeetCode 150](https://neetcode.io/practice)                                           |
| [3]       | DataDriven.io & DataLemur: Dedicated Data Engineering interview preparation and practice sets.               |
| [4]       | ByteByteGo: High-level System Design fundamentals and distributed architecture patterns.                     |
| [5]       | Apache Spark & Kafka Documentation: Official open-source technical reference manuals.                        |

<!-- vale on -->
