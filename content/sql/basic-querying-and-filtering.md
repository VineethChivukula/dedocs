# Basic querying and filtering

## Overview

Basic SQL querying and filtering statements retrieve data from relational
database management systems. Use `SELECT` to choose the data to
return and filtering clauses and operators to limit the rows in the result.

This guide provides a systematic reference for querying and filtering tabular
data. It explains the logical execution mechanics of projections, comparison
predicates, three-valued Boolean logic, range evaluations, pattern matching,
and compound logical operator precedence through concrete datasets and
step-by-step row evaluation traces.

## Reference dataset

The examples throughout this guide query the following `Employees` table.
The dataset includes diverse departments, compensation structures, job
titles, timestamp values, and `NULL` attributes to illustrate filtering
edge cases:

```sql
CREATE TABLE Employees (
  EmployeeID    INTEGER PRIMARY KEY,
  FirstName     VARCHAR(50) NOT NULL,
  LastName      VARCHAR(50) NOT NULL,
  JobTitle      VARCHAR(50) NOT NULL,
  DepartmentID  INTEGER,
  Salary        NUMERIC(10, 2) NOT NULL,
  CommissionPct NUMERIC(4, 2),
  HireDate      TIMESTAMP NOT NULL
);
```

### `Employees` table contents

| EmployeeID | FirstName | LastName | JobTitle | DepartmentID | Salary | CommissionPct | HireDate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | Alice | Smith | Senior Software Engineer | `10` | `95000.00` | `0.10` | `2023-01-15 09:30:00` |
| `102` | Bob | Jones | Software Engineer | `10` | `72000.00` | `NULL` | `2023-01-31 16:45:00` |
| `103` | Charlie | Brown | Data Analyst | `20` | `65000.00` | `0.05` | `2023-02-01 08:00:00` |
| `104` | Diana | Prince | Quality Analyst | `20` | `58000.00` | `NULL` | `2023-02-15 11:15:00` |
| `105` | Evan | Wright | Support Specialist | `30` | `42000.00` | `NULL` | `2023-03-01 10:00:00` |
| `106` | Frank | Miller | Technical Writer | `NULL` | `51000.00` | `NULL` | `2023-03-15 14:20:00` |
| `107` | Grace | Hopper | Systems Architect | `10` | `115000.00` | `0.15` | `2023-04-01 09:00:00` |
| `108` | Test | Account | Software Engineer | `10` | `35000.00` | `NULL` | `2023-04-10 12:00:00` |

## Core concepts

### Projection with `SELECT`

The `SELECT` clause specifies the column list or calculated expressions that
the query returns. In relational algebra, this operation represents attribute
projection $\pi$.

#### Specific column projection

Selecting explicit columns reduces network transmission volume and avoids
reading unneeded table data from disk cache:

```sql
SELECT
  EmployeeID,
  FirstName,
  LastName,
  Salary
FROM Employees;
```

| EmployeeID | FirstName | LastName | Salary |
| :--- | :--- | :--- | :--- |
| `101` | Alice | Smith | `95000.00` |
| `102` | Bob | Jones | `72000.00` |
| `103` | Charlie | Brown | `65000.00` |
| `104` | Diana | Prince | `58000.00` |
| `105` | Evan | Wright | `42000.00` |
| `106` | Frank | Miller | `51000.00` |
| `107` | Grace | Hopper | `115000.00` |
| `108` | Test | Account | `35000.00` |

#### Calculated expressions and column aliases

`SELECT` can evaluate arithmetic expressions, concatenate text strings, and
assign human-readable column aliases with the `AS` keyword:

```sql
SELECT
  EmployeeID,
  FirstName || ' ' || LastName AS FullName,
  Salary,
  ROUND(Salary * 1.08, 2) AS ProjectedSalary
FROM Employees
WHERE DepartmentID = 20;
```

| EmployeeID | FullName | Salary | ProjectedSalary |
| :--- | :--- | :--- | :--- |
| `103` | Charlie Brown | `65000.00` | `70200.00` |
| `104` | Diana Prince | `58000.00` | `62640.00` |

### Row filtering with `WHERE`

The `WHERE` clause applies a filtering predicate to each candidate row
produced by the `FROM` clause. In relational algebra, this operation
represents selection $\sigma$.

SQL operates under three-valued logic. A condition evaluates to one of three
truth states: `TRUE`, `FALSE`, or `UNKNOWN`. The database engine keeps only
rows whose predicate evaluates to `TRUE`. It discards rows evaluating to
`FALSE` or `UNKNOWN`.

```sql
SELECT
  EmployeeID,
  LastName,
  Salary
FROM Employees
WHERE Salary >= 65000.00;
```

#### Row evaluation trace

The database engine inspects each row against the predicate
`Salary >= 65000.00`:

| EmployeeID | LastName | Candidate Salary | Evaluation of `Salary >= 65000.00` | Action |
| :--- | :--- | :--- | :--- | :--- |
| `101` | Smith | `95000.00` | `95000.00 >= 65000.00` $\rightarrow$ `TRUE` | Kept in result |
| `102` | Jones | `72000.00` | `72000.00 >= 65000.00` $\rightarrow$ `TRUE` | Kept in result |
| `103` | Brown | `65000.00` | `65000.00 >= 65000.00` $\rightarrow$ `TRUE` | Kept in result |
| `104` | Prince | `58000.00` | `58000.00 >= 65000.00` $\rightarrow$ `FALSE` | Discarded |
| `105` | Wright | `42000.00` | `42000.00 >= 65000.00` $\rightarrow$ `FALSE` | Discarded |
| `106` | Miller | `51000.00` | `51000.00 >= 65000.00` $\rightarrow$ `FALSE` | Discarded |
| `107` | Hopper | `115000.00` | `115000.00 >= 65000.00` $\rightarrow$ `TRUE` | Kept in result |
| `108` | Account | `35000.00` | `35000.00 >= 65000.00` $\rightarrow$ `FALSE` | Discarded |

#### Resultant output

| EmployeeID | LastName | Salary |
| :--- | :--- | :--- |
| `101` | Smith | `95000.00` |
| `102` | Jones | `72000.00` |
| `103` | Brown | `65000.00` |
| `107` | Hopper | `115000.00` |

### Logical operators and precedence mechanics

Combine or invert conditions using `AND`, `OR`, and `NOT`:

- `AND` produces `TRUE` only when both operands evaluate to `TRUE`.
- `OR` produces `TRUE` when at least one operand evaluates to `TRUE`.
- `NOT` reverses the truth value: `TRUE` becomes `FALSE`, and `FALSE` becomes `TRUE`.

`AND` binds more tightly than `OR`. For example, the engine evaluates
`A OR B AND C` as `A OR (B AND C)`. Omitting parentheses causes logic bugs.

Consider this query with intended grouping:

```sql
SELECT
  EmployeeID,
  LastName,
  DepartmentID,
  Salary
FROM Employees
WHERE (DepartmentID = 10 OR DepartmentID = 20)
  AND Salary <= 65000.00;
```

#### Comparison of precedence behaviors

The table below contrasts the explicit grouped condition with the condition
without parentheses `DepartmentID = 10 OR DepartmentID = 20 AND Salary <= 65000.00`:

| EmployeeID | DepartmentID | Salary | Grouped Condition | Condition Without Parentheses |
| :--- | :--- | :--- | :--- | :--- |
| `101` | `10` | `95000.00` | `TRUE` and `FALSE` $\rightarrow$ `FALSE` - discard | `TRUE` or `FALSE` $\rightarrow$ `TRUE` - leak |
| `102` | `10` | `72000.00` | `TRUE` and `FALSE` $\rightarrow$ `FALSE` - discard | `TRUE` or `FALSE` $\rightarrow$ `TRUE` - leak |
| `103` | `20` | `65000.00` | `TRUE` and `TRUE` $\rightarrow$ `TRUE` - retain | `FALSE` or `TRUE` $\rightarrow$ `TRUE` - retain |
| `104` | `20` | `58000.00` | `TRUE` and `TRUE` $\rightarrow$ `TRUE` - retain | `FALSE` or `TRUE` $\rightarrow$ `TRUE` - retain |
| `105` | `30` | `42000.00` | `FALSE` and `TRUE` $\rightarrow$ `FALSE` - discard | `FALSE` or `FALSE` $\rightarrow$ `FALSE` - discard |
| `107` | `10` | `115000.00` | `TRUE` and `FALSE` $\rightarrow$ `FALSE` - discard | `TRUE` or `FALSE` $\rightarrow$ `TRUE` - leak |
| `108` | `10` | `35000.00` | `TRUE` and `TRUE` $\rightarrow$ `TRUE` - retain | `TRUE` or `TRUE` $\rightarrow$ `TRUE` - retain |

The condition without parentheses unintentionally returns every employee in
department `10`, regardless of salary. The grouped query produces the
intended result:

| EmployeeID | LastName | DepartmentID | Salary |
| :--- | :--- | :--- | :--- |
| `103` | Brown | `20` | `65000.00` |
| `104` | Prince | `20` | `58000.00` |
| `108` | Account | `10` | `35000.00` |

### Inclusive range evaluation with `BETWEEN`

The `BETWEEN` operator evaluates whether a candidate expression falls within
a continuous range, inclusive of both endpoint values:

```sql
SELECT
  EmployeeID,
  LastName,
  Salary
FROM Employees
WHERE Salary BETWEEN 58000.00 AND 72000.00;
```

This predicate is equivalent to:

```sql
WHERE Salary >= 58000.00 AND Salary <= 72000.00
```

#### Resultant output

Because both boundary values are inclusive, the query retains rows with
salaries of exactly `58000.00` and `72000.00`:

| EmployeeID | LastName | Salary |
| :--- | :--- | :--- |
| `102` | Jones | `72000.00` |
| `103` | Brown | `65000.00` |
| `104` | Prince | `58000.00` |

> [!NOTE]
> `BETWEEN` requires the lower bound first: `BETWEEN low AND high`. If you
> write `BETWEEN 72000.00 AND 58000.00`, the condition expands to
> `Salary >= 72000.00 AND Salary <= 58000.00`, which always evaluates to
> `FALSE` and returns zero rows.

### Discrete set membership with `IN`

The `IN` operator evaluates whether a scalar value matches any element in an
explicit list of expressions or inner query results:

```sql
SELECT
  EmployeeID,
  LastName,
  DepartmentID
FROM Employees
WHERE DepartmentID IN (20, 30);
```

The database engine expands this predicate into an equality disjunction:

```sql
WHERE DepartmentID = 20 OR DepartmentID = 30
```

#### Resultant output

| EmployeeID | LastName | DepartmentID |
| :--- | :--- | :--- |
| `103` | Brown | `20` |
| `104` | Prince | `20` |
| `105` | Wright | `30` |

### Pattern matching with `LIKE`

The `LIKE` operator evaluates character string expressions against a wildcard
pattern. Standard SQL defines two wildcard characters:

- Percent symbol `%`: matches zero or more arbitrary characters.
- Underscore symbol `_`: matches exactly one arbitrary character.

#### Pattern matching examples

```sql
-- Matches job titles containing 'Analyst' anywhere in the string
SELECT EmployeeID, LastName, JobTitle
FROM Employees
WHERE JobTitle LIKE '%Analyst%';
```

| EmployeeID | LastName | JobTitle | Match explanation |
| :--- | :--- | :--- | :--- |
| `103` | Brown | Data Analyst | Suffix match |
| `104` | Prince | Quality Analyst | Suffix match |

```sql
-- Matches job titles where the second character is 'y' (Systems Architect)
SELECT EmployeeID, LastName, JobTitle
FROM Employees
WHERE JobTitle LIKE '_y%';
```

| EmployeeID | LastName | JobTitle | Match explanation |
| :--- | :--- | :--- | :--- |
| `107` | Hopper | Systems Architect | Second character is `y` |

## Step-by-step complete filtering trace

Consider a compound production query that applies multiple simultaneous
predicates across distinct data types:

```sql
SELECT
  EmployeeID,
  FirstName,
  LastName,
  JobTitle,
  DepartmentID,
  Salary
FROM Employees
WHERE DepartmentID IN (10, 20)
  AND Salary BETWEEN 50000.00 AND 100000.00
  AND (JobTitle LIKE '%Engineer%' OR JobTitle LIKE '%Analyst%')
  AND LastName NOT LIKE 'Account%'
ORDER BY EmployeeID;
```

### Complete evaluation matrix

The database engine evaluates candidate rows through each filter predicate:

| EmployeeID | Dept in List | Salary Range | Job Title Match | Not Account | Final Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | `10`: `TRUE` | `95000`: `TRUE` | Senior Software Engineer: `TRUE` | Smith: `TRUE` | Retained |
| `102` | `10`: `TRUE` | `72000`: `TRUE` | Software Engineer: `TRUE` | Jones: `TRUE` | Retained |
| `103` | `20`: `TRUE` | `65000`: `TRUE` | Data Analyst: `TRUE` | Brown: `TRUE` | Retained |
| `104` | `20`: `TRUE` | `58000`: `TRUE` | Quality Analyst: `TRUE` | Prince: `TRUE` | Retained |
| `105` | `30`: `FALSE` | `42000`: `FALSE` | Support Specialist: `FALSE` | Wright: `TRUE` | Discarded: department, salary, title |
| `106` | `NULL`: `UNKNOWN` | `51000`: `TRUE` | Technical Writer: `FALSE` | Miller: `TRUE` | Discarded: department unknown, title |
| `107` | `10`: `TRUE` | `115000`: `FALSE` | Systems Architect: `FALSE` | Hopper: `TRUE` | Discarded: salary exceeds 100k, title |
| `108` | `10`: `TRUE` | `35000`: `FALSE` | Software Engineer: `TRUE` | Account: `FALSE` | Discarded: salary below 50k, account |

### Final output table

| EmployeeID | FirstName | LastName | JobTitle | DepartmentID | Salary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | Alice | Smith | Senior Software Engineer | `10` | `95000.00` |
| `102` | Bob | Jones | Software Engineer | `10` | `72000.00` |
| `103` | Charlie | Brown | Data Analyst | `20` | `65000.00` |
| `104` | Diana | Prince | Quality Analyst | `20` | `58000.00` |

## Common pitfalls

### `NULL` values in `NOT IN` predicates

A query using `NOT IN` returns zero rows if the comparison list or nested query
contains a `NULL` value.

Consider this query:

```sql
SELECT EmployeeID, LastName
FROM Employees
WHERE DepartmentID NOT IN (20, 30, NULL);
```

#### Predicate expansion under three-valued logic

SQL expands `x NOT IN (a, b, c)` as `NOT (x = a OR x = b OR x = c)`. Applying
De Morgan's laws converts this expression into:

```sql
WHERE (DepartmentID <> 20)
  AND (DepartmentID <> 30)
  AND (DepartmentID <> NULL)
```

Because comparing any scalar value to `NULL` yields `UNKNOWN`, the term
`(DepartmentID <> NULL)` always evaluates to `UNKNOWN`:

$$\text{TRUE} \land \text{TRUE} \land \text{UNKNOWN} \implies \text{UNKNOWN}$$

Because a `WHERE` clause filters out candidate rows that don't evaluate
to `TRUE`, the engine discards every single row, returning an empty result set.

#### Safe implementation alternatives

Use `NOT EXISTS` with a correlated nested query or explicitly filter `NULL`
values in the inner query:

```sql
-- Safe option 1: Filter NULL in nested query
SELECT EmployeeID, LastName
FROM Employees
WHERE DepartmentID NOT IN (
  SELECT DepartmentID
  FROM Departments
  WHERE DepartmentID IS NOT NULL
);

-- Safe option 2: Use NOT EXISTS
SELECT e.EmployeeID, e.LastName
FROM Employees AS e
WHERE NOT EXISTS (
  SELECT 1
  FROM Departments AS d
  WHERE d.DepartmentID = e.DepartmentID
);
```

### Date and timestamp boundary truncation

Filtering timestamp columns with date-only literals using `BETWEEN` omits
events that occur later during the ending day:

```sql
-- Flawed query: excludes events after midnight on 2023-01-31
SELECT EmployeeID, LastName, HireDate
FROM Employees
WHERE HireDate BETWEEN '2023-01-01' AND '2023-01-31';
```

The database engine casts the string `'2023-01-31'` to `2023-01-31 00:00:00`.
Consequently, the engine excludes Bob Jones with hire timestamp `2023-01-31 16:45:00`
because `16:45:00` exceeds midnight.

#### Safe half-open interval pattern

Use a half-open interval with `>= start` and `< end_plus_one` to capture every
fractional millisecond of the final target day:

```sql
SELECT EmployeeID, LastName, HireDate
FROM Employees
WHERE HireDate >= '2023-01-01'
  AND HireDate <  '2023-02-01';
```

| EmployeeID | LastName | HireDate | Inclusion Explanation |
| :--- | :--- | :--- | :--- |
| `101` | Smith | `2023-01-15 09:30:00` | Within range |
| `102` | Jones | `2023-01-31 16:45:00` | Correctly captured on target date |

### Leading wildcards and index search mechanics

A predicate is search-argumentable, known as `SARGable`, when the database query optimizer
can navigate a B-tree index directly to locate candidate rows.

- Search-argumentable prefix: `LastName LIKE 'Sm%'`. The B-tree root and branch
  nodes search by the leading prefix `'Sm'` with $O(\log N)$ index seeks.
- Non-search-argumentable pattern: `JobTitle LIKE '%Engineer'`. A leading wildcard
  forces the database engine to execute an $O(N)$ full table scan because the
  index key order can't determine which entries end with `'Engineer'`.

When querying high-cardinality text columns, evaluate database full-text
search indices or trigram indexes such as `pg_trgm` in PostgreSQL rather
than relying on leading wildcards.

## Key takeaways

- Project only required attributes in `SELECT` to reduce network transmission
  and memory overhead.
- SQL filtering operates under three-valued logic. The engine discards rows
  evaluating to `FALSE` or `UNKNOWN` in `WHERE`.
- Logical `AND` binds more tightly than `OR`. Group disjunctions in parentheses
  to enforce intended evaluation order.
- `BETWEEN` includes both lower and upper boundary values.
- `NOT IN` containing `NULL` yields `UNKNOWN` for all comparisons. Prefer
  `NOT EXISTS` or filter `NULL` explicitly.
- Filter timestamp ranges with half-open intervals such as `>= start AND < next_period`
  to avoid truncating fractional day records.
- Avoid leading wildcards on indexed columns to maintain index seek efficiency.
