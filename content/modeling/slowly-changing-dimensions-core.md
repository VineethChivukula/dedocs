# Slowly changing dimensions core

Dimension tables provide descriptive context, such as customer profiles,
product catalogs, or store locations, for numerical performance metrics in
dimensional modeling. While descriptive attributes remain relatively static
over time compared to high-frequency transactional data, they do occasionally
change.

Data engineering defines these mutating attributes as slowly changing
dimensions, known as SCDs. Selecting the appropriate SCD strategy determines how an
enterprise data warehouse balances historical accuracy against current state
representation. The core dimensional modeling methodology defines three
foundational patterns for managing attribute mutations: type 0 to retain
original values, type 1 to overwrite current data, and type 2 to preserve full
version history.

## Core SCD types

Data warehouses categorize attribute change handling into distinct numbered
types based on how they process updates and preserve historical context.

### Type 0: retain original

Type 0 retains the initial baseline attribute value permanently. When an
ingestion pipeline creates a dimension record, it sets the attribute value once
and never updates or overwrites it, regardless of operational modifications in
upstream source systems.

- Concept: the attribute represents an immutable baseline fact that must
  remain fixed for the entire life of the data warehouse.
- Mechanics: implemented as an insert-only pipeline. The ETL pipeline ignores
  subsequent updates to Type 0 attributes in operational source systems.
- Primary use case: immutable attributes or initial baseline metrics, such as a
  customer's original sign-up date, durable birth date, or a product's initial
  release SKU.
- Operational trade-off: simple to maintain and preserves baseline facts, but
  can't capture real-world operational corrections if data entry errors occur.

### Type 1: overwrite current value

Type 1 directly overwrites the existing attribute value with the new value
whenever a change occurs in the operational source system.

- Concept: the data warehouse reflects only the current state of the attribute.
  No historical lineage remains, and prior values are permanently erased.
- Mechanics: implemented as an in-place `UPDATE` statement on the dimension
  table.
- Fact table impact: past fact rows remain linked to the same dimension
  surrogate key. When analysts query historical transactions, those transactions
  automatically group under the newly overwritten attribute value.
- Primary use case: correcting operational data entry mistakes (such as fixing
  a typographical error in a customer's name) or managing attributes where
  historical tracking provides no business value.
- Operational trade-off: fast to execute and keeps dimension table row counts
  stable without generating new surrogate keys. However, it completely erases
  historical context and invalidates pre-calculated aggregate summary tables or
  materialized views, requiring them to be rebuilt to maintain consistency.

### Type 2: add a dimension row for full history

Type 2 is the primary workhorse technique for accurately preserving historical
attribute changes in dimensional modeling. When an attribute value changes, the
pipeline inserts a new dimension row containing the updated values alongside a
new surrogate primary key.

- Natural key: the operational business identifier, such as `customer_id` or
  `sku`, remains identical across all historical rows for that entity, linking
  its complete lifecycle together.
- Surrogate key: each version of the entity receives a unique integer
  surrogate key. For example, a customer record receives key 5001 for the
  initial profile and key 5002 for the updated profile.
- Fact table isolation: past transactions remain linked to historical surrogate
  key 5001, preserving historical truth at the time the event occurred. New
  transactions link to new surrogate key 5002, automatically partitioning
  history forward in time without altering past fact rows.
- Audit tracking attributes:
  - `eff_start_date`: start date or timestamp when the record version became
    active.
  - `eff_end_date`: end date or timestamp when the record version was
    superseded, typically assigned a high dummy date like `9999-01-01` for the
    active version.
  - `is_current`: boolean flag (`TRUE` or `FALSE`) identifying the active record
    version for simplified filtering.
- Primary use case: core business attributes where historical reporting
  accuracy is critical, such as customer address moves, sales territory
  realignments, or product category reassignments.
- Operational trade-off: provides complete, audit-grade historical accuracy
  without mutating historical fact records. However, it accelerates dimension
  table row growth, requires surrogate key pipeline management, and means
  counting unique business entities requires `COUNT(DISTINCT customer_id)` on
  natural keys rather than counting surrogate keys.

## Comparison of core SCD strategies

The following matrix summarizes the operational actions, history retention,
and architectural impacts of each core SCD strategy:

| Strategy | Action on change | History retained | Primary key structure | Fact table impact |
| :--- | :--- | :--- | :--- | :--- |
| Type 0: retain | None: updates ignored | Initial baseline only | Natural key or static surrogate key | None |
| Type 1: overwrite | Overwrites existing row in place | No: prior values erased | Same surrogate key | Past facts re-group under new attribute value |
| Type 2: add row | Inserts new dimension row | Yes: complete version history | New surrogate key per version | Past facts remain linked to historical surrogate key |

## Comprehensive customer profile lifecycle

To understand how these three strategies interact within a single dimension
table, consider customer `CUST-1001` tracking three distinct attributes:

- `original_signup_date`: type 0 attribute that retains original values
- `marital_status`: type 1 attribute that overwrites current values
- `zip_code`: type 2 attribute that tracks historical moves using dates and flags

### Initial record creation

On January 1, 2025, customer `CUST-1001` registers in postal code `84101` with a
marital status of `Single`. The ETL pipeline inserts the initial dimension row:

| `customer_key` | `customer_id` | `original_signup_date` | `marital_status` | `zip_code` | `eff_start_date` | `eff_end_date` | `is_current` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5001 | `CUST-1001` | 2025-01-01 | Single | 84101 | 2025-01-01 | 9999-01-01 | `TRUE` |

All sales transactions logged between January 1, 2025 and January 14, 2026 link
to `customer_key = 5001`.

### Event 1: customer relocation

On January 15, 2026, customer `CUST-1001` moves to postal code `84123`. Because
`zip_code` is a Type 2 attribute, the pipeline performs two atomic operations:

1. Closes the active version for `customer_key = 5001` by setting `eff_end_date`
   to `2026-01-14` and `is_current` to `FALSE`.
2. Inserts a new dimension row with `customer_key = 5002`, capturing the new
   postal code:

| `customer_key` | `customer_id` | `original_signup_date` | `marital_status` | `zip_code` | `eff_start_date` | `eff_end_date` | `is_current` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5001 | `CUST-1001` | 2025-01-01 | Single | 84101 | 2025-01-01 | 2026-01-14 | `FALSE` |
| 5002 | `CUST-1001` | 2025-01-01 | Single | 84123 | 2026-01-15 | 9999-01-01 | `TRUE` |

Historical sales transactions prior to January 15, 2026 remain attached to
`customer_key = 5001` and aggregate under postal code `84101`. Any new sales
transactions after January 15 link to `customer_key = 5002`.

### Event 2: marital status update

On February 1, 2026, the customer corrects their marital status to `Married`.
Because `marital_status` is a Type 1 attribute, the pipeline updates the value
in place across all versions of `CUST-1001`:

| `customer_key` | `customer_id` | `original_signup_date` | `marital_status` | `zip_code` | `eff_start_date` | `eff_end_date` | `is_current` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 5001 | `CUST-1001` | 2025-01-01 | Married | 84101 | 2025-01-01 | 2026-01-14 | `FALSE` |
| 5002 | `CUST-1001` | 2025-01-01 | Married | 84123 | 2026-01-15 | 9999-01-01 | `TRUE` |

The marital status update applies across both historical and current rows
without generating a new surrogate key or modifying date ranges.

## Production schema implementation

The following PostgreSQL schema defines a dimension table supporting Type 0,
Type 1, and Type 2 attributes alongside queries demonstrating analytical
usage:

```sql
-- Dimension table supporting Type 0, Type 1, and Type 2 attributes
CREATE TABLE dim_customer (
    customer_key         BIGINT PRIMARY KEY,
    customer_id          VARCHAR(20) NOT NULL,
    original_signup_date DATE NOT NULL,        -- Type 0: Retain original
    marital_status       VARCHAR(20) NOT NULL, -- Type 1: Overwrite in place
    zip_code             VARCHAR(10) NOT NULL, -- Type 2: History tracked
    
    -- Type 2 audit tracking columns
    eff_start_date       DATE NOT NULL,
    eff_end_date         DATE NOT NULL DEFAULT '9999-01-01',
    is_current           BOOLEAN NOT NULL DEFAULT TRUE
);

-- Query current active records only
SELECT 
    customer_id,
    marital_status,
    zip_code
FROM dim_customer 
WHERE is_current = TRUE;

-- Analytical query joining facts directly via surrogate key
-- Preserves accurate historical postal code at time of sale
SELECT 
    c.customer_id,
    c.zip_code AS historical_zip_at_sale,
    SUM(f.gross_sales_amt) AS total_sales
FROM fact_sales f
JOIN dim_customer c 
    ON f.customer_key = c.customer_key
GROUP BY 
    c.customer_id,
    c.zip_code;
```

## Operational considerations and query engine optimization

Managing slowly changing dimensions in modern columnar data warehouses, such as
Google BigQuery, Snowflake, and Amazon Redshift, requires balancing storage
layout and ETL pipeline complexity:

### High open dates versus null expiration values

Always use a concrete future date, such as `9999-01-01`, rather than `NULL` for
active Type 2 records. When querying point-in-time dimension snapshots, SQL
queries filter with range conditions:

```sql
WHERE event_date >= eff_start_date 
  AND event_date < eff_end_date
```

Using a concrete high date avoids complex boolean expressions, such as
`OR eff_end_date IS NULL`, which often prevent query planners from using
partition pruning and range-based metadata min-max pruning.

### Columnar compression and dictionary encoding

Columnar storage engines compress Type 2 dimensions efficiently. Because Type 2
updates duplicate unchanged attributes across multiple rows for the same
entity, dictionary encoding and run-length encoding compress these repeated
strings into compact integer references, minimizing disk consumption.

### Detecting changes with hash differences

In high-throughput ELT pipelines, avoid comparing individual columns one by one
to determine whether an attribute mutated. Compute a cryptographic hash across
all Type 2 tracked attributes in the staging table, and compare it against the
active dimension record's stored hash difference. If the hashes match, skip the
record. If they differ, trigger a Type 2 version expiration and insertion.

## Common pitfalls

When designing slowly changing dimensions, watch for these frequent mistakes:

### Invalidating pre-aggregated summaries with Type 1 overwrites

Overwriting an attribute with Type 1 changes the historical grouping of past
transactions. If an enterprise maintains pre-aggregated summary tables,
materialized views, or financial reports grouped by the modified attribute,
overwriting the dimension record creates silent reporting discrepancies. Always
rebuild downstream summary structures after executing Type 1 updates.

### Using natural keys instead of surrogate keys in Type 2 dimensions

Attempting to use the operational natural key `customer_id` as the primary
key in a Type 2 dimension causes primary key collision errors on the second
version insert. Type 2 history tracking strictly requires single-column
surrogate integer keys to uniquely identify each temporal version of a business
entity.

### Joining fact tables to dimensions using date ranges instead of surrogate keys

A frequent anti-pattern is attempting to join fact tables to dimensions using the
natural key and transaction date:

```sql
-- Anti-pattern: joining facts on date ranges
SELECT *
FROM fact_sales f
JOIN dim_customer c 
    ON f.customer_id = c.customer_id
   AND f.order_date >= c.eff_start_date 
   AND f.order_date < c.eff_end_date;
```

This anti-pattern forces the query engine into expensive range joins instead of
fast equi-joins. Fact tables must store the explicit surrogate key active at the
moment the transaction occurs, such as `customer_key = 5001`, allowing direct
equi-joins on integers. Date range filters support point-in-time dimension
lookups, not fact table joins.

### Updating historical fact rows during Type 2 dimension changes

When an entity undergoes a Type 2 update, past fact records must remain
untouched. Modifying historical fact rows to point to the new surrogate key
erases the historical context of where and how events occurred, destroying the
core purpose of Type 2 tracking.

### Tracking rapidly changing attributes with Type 2 history

Applying Type 2 history tracking to attributes that update daily, such as account
balances and customer credit scores, causes catastrophic dimension table bloat.
A 10-million-row customer table updated daily creates billions of rows in a
single year. Break off rapidly changing attributes into separate minidimensions,
such as Type 4 minidimensions, rather than generating runaway Type 2 rows.

### Relying on simple row counts for entity totals

In a dimension table containing Type 2 historical records, running `COUNT(*)` or
`COUNT(customer_key)` counts record versions, not unique business entities. In
a customer dimension where users average three historical versions, `COUNT(*)`
reports three times the true customer count. Always query
`COUNT(DISTINCT customer_id)` when calculating unique entity counts.

## What's next

- Learn how to handle rapidly changing attributes and minidimensions in
  [Specialized fact designs](/modeling/specialized-fact-designs).
- Review surrogate key generation and hash key pipelines in
  [Primary and key management](/modeling/primary-and-key-management).
- Explore star schema and snowflake architectures in
  [Schema architectures](/modeling/schema-architectures).
- Study join execution strategies and join hashing algorithms in
  [Advanced query optimization](/sql/advanced-query-optimization).
