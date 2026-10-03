# Value and frame navigation

## Overview

Value-navigation functions compare a row with earlier or later rows in the
same window. Window frames define the subset of rows that a window function
uses for a calculation relative to the current row.

Together, these features support row-to-row comparisons, time-series
calculations, moving averages, and other sliding calculations without
requiring a self-join.

This guide introduces `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`, and the
`ROWS` and `RANGE` frame units.

## Value-navigation functions

Each value-navigation function uses the logical order defined by `ORDER BY`
inside `OVER`. Use `PARTITION BY` to restart the calculation for each group.

### `LAG`

`LAG` returns a value from an earlier row in the partition:

```sql
LAG(expression, offset, default_value) OVER (
  PARTITION BY partition_column
  ORDER BY sort_column
)
```

- `expression` is the value to return.
- `offset` is the number of rows to look backward. The default is `1`.
- `default_value` supplies the result when no earlier row exists. If you omit
  it, the function returns `NULL`.

For example:

```sql
LAG(SalesAmount, 1, 0) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
) AS PreviousDaySales
```

### `LEAD`

`LEAD` returns a value from a later row in the partition:

```sql
LEAD(expression, offset, default_value) OVER (
  PARTITION BY partition_column
  ORDER BY sort_column
)
```

For example:

```sql
LEAD(SalesAmount) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
) AS NextDaySales
```

If no later row exists, `LEAD` returns the specified default or `NULL` when
you omit the default.

### `FIRST_VALUE`

`FIRST_VALUE` returns the expression value from the first row in the window
frame according to the window order:

```sql
FIRST_VALUE(SalesAmount) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) AS OpeningDaySales
```

The explicit frame makes the function consider the entire partition. Without
an explicit frame, the default frame can end at the current row, which is
usually still sufficient for `FIRST_VALUE` but is important when you use
other frame-sensitive functions.

### `LAST_VALUE`

`LAST_VALUE` returns the expression value from the last row in the window
frame. Because the default frame often ends at the current row,
`LAST_VALUE` can return the current row's value instead of the final value in
the partition.

To return the final value for the entire partition, specify the full frame:

```sql
LAST_VALUE(SalesAmount) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) AS LatestSales
```

Use an explicit frame whenever you need the first or last value across the
entire partition.

## Window frames

A window frame is a subset of a partition relative to the current row. It
controls which rows an aggregate or frame-sensitive function uses:

```sql
{ROWS | RANGE} BETWEEN frame_start AND frame_end
```

Common frame boundaries include:

- `UNBOUNDED PRECEDING`: the first row in the partition.
- `n PRECEDING`: a specified number of rows or range units before the current
  row.
- `CURRENT ROW`: the current row, or the current peer group for some `RANGE`
  frames.
- `n FOLLOWING`: a specified number of rows or range units after the current
  row.
- `UNBOUNDED FOLLOWING`: the last row in the partition.

For example, this frame contains the current row and the two preceding rows:

```sql
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
```

### `ROWS`

`ROWS` counts physical rows in the window order. With
`ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING`, the frame contains up to three
rows: the previous row, the current row, and the next row.

Use `ROWS` when the calculation should include a specific number of rows,
even when multiple rows have the same ordering value.

### `RANGE`

`RANGE` groups rows by their ordering values. Rows with the same value are
peers, and a frame can include all peers at a boundary. Some database engines
also support numeric or interval ranges, such as a time interval around the
current value.

Use `RANGE` when the calculation should follow value-based boundaries, such
as all records in the same date or all records within a time interval.
Supported `RANGE` syntax varies by database engine.

Consider this data:

| SaleDate | SalesAmount |
| --- | ---: |
| 2026-01-01 | 1000 |
| 2026-01-02 | 1500 |
| 2026-01-02 | 1200 |

With `ROWS`, the two rows dated January 2 are separate physical rows. With a
default `RANGE` frame, they're peers because they share the same ordering
value. This difference can change cumulative totals.

### Default frame behavior

When an ordered window aggregate doesn't specify a frame, many SQL engines use
a default similar to:

```sql
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

This commonly produces a cumulative result rather than the total for the
entire partition. The exact default and supported frame syntax depend on the
database engine and function.

Specify the frame explicitly when you need predictable behavior:

```sql
SUM(SalesAmount) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) AS RunningSales
```

## Complete example

Suppose that a `DailySales` table contains `Store`, `SaleDate`, and
`SalesAmount`. The following query compares each day with its neighbors,
returns the first and last sales values for the store, and calculates a
three-row moving average:

```sql
SELECT
  Store,
  SaleDate,
  SalesAmount,
  LAG(SalesAmount, 1, 0) OVER (
    PARTITION BY Store
    ORDER BY SaleDate
  ) AS PreviousDaySales,
  LEAD(SalesAmount) OVER (
    PARTITION BY Store
    ORDER BY SaleDate
  ) AS NextDaySales,
  FIRST_VALUE(SalesAmount) OVER (
    PARTITION BY Store
    ORDER BY SaleDate
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS OpeningDaySales,
  LAST_VALUE(SalesAmount) OVER (
    PARTITION BY Store
    ORDER BY SaleDate
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS LatestSales,
  AVG(SalesAmount) OVER (
    PARTITION BY Store
    ORDER BY SaleDate
    ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
  ) AS ThreeDayMovingAverage
FROM DailySales;
```

For these rows in `Store A`:

| SaleDate | SalesAmount |
| --- | ---: |
| 2026-01-01 | 1000 |
| 2026-01-02 | 1500 |
| 2026-01-03 | 1200 |
| 2026-01-04 | 2200 |

The result includes:

| SaleDate | Previous day | Next day | Opening sales | Final sales | Three-day average |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-01-01 | 0 | 1500 | 1000 | 2200 | 1250 |
| 2026-01-02 | 1000 | 1200 | 1000 | 2200 | 1233.33 |
| 2026-01-03 | 1500 | 2200 | 1000 | 2200 | 1633.33 |
| 2026-01-04 | 1200 | `NULL` | 1000 | 2200 | 1700 |

The first and last rows use the `LAG` default and the `LEAD` boundary
`NULL`, respectively. At the boundaries, the moving-average frame contains
fewer than three rows.

## Common pitfalls

### The `LAST_VALUE` default-frame trap

This expression can return the current row's value instead of the final value
in the partition:

```sql
LAST_VALUE(SalesAmount) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
)
```

Use a full explicit frame when you need the last value in the partition:

```sql
LAST_VALUE(SalesAmount) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
```

### Ties with `RANGE` and `ROWS`

`RANGE` can include all rows that share the current ordering value, while
`ROWS` counts physical rows. If dates or timestamps can repeat, choose the
frame unit deliberately.

Add a unique tie-breaker to the window order when the row order must be
deterministic:

```sql
ORDER BY SaleDate, SaleID
```

### Boundary `NULL` values

`LAG` returns `NULL` when the requested earlier row doesn't exist.
`LEAD` returns `NULL` when the requested later row doesn't exist. Use the
optional default argument when a missing boundary should have a specific
value:

```sql
LAG(SalesAmount, 1, 0) OVER (
  PARTITION BY Store
  ORDER BY SaleDate
)
```

Don't replace a meaningful missing value with zero unless the data model
defines those values as equivalent.

### Cost of value-based frames

`RANGE` frames can require the database to identify peer rows or evaluate
value-based intervals. On large data sets, this can use more memory or
processing time than a simple `ROWS` frame.

Choose the frame that matches the calculation, index the columns used for
partitioning and ordering when appropriate, and inspect the execution plan
for performance-sensitive queries. The actual cost depends on the database
engine and query plan.

## Key takeaways

- Use `LAG` and `LEAD` to compare a row with earlier or later rows.
- Use `FIRST_VALUE` and `LAST_VALUE` to retrieve values from a window frame.
- Use `ROWS` to count physical rows and `RANGE` for value-based peer groups or
  intervals.
- Specify an explicit frame when cumulative or full-partition behavior matters.
- Provide tie-breakers when ordering values can repeat.
- Handle boundary `NULL` values and defaults according to the data model.
