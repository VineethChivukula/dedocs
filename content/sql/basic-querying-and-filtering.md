# Basic querying and filtering

Basic SQL querying and filtering statements retrieve data from relational
database management systems. Use `SELECT` to choose the data attributes to
return and filtering clauses and operators to limit the rows in the result.

This guide provides a systematic reference for querying and filtering tabular
data. It explains the logical execution flow of projections, comparison
predicates, three-valued Boolean logic, range evaluations, pattern matching,
and compound logical operator precedence through the canonical Stanford
University academic dataset.

## Reference dataset

The examples throughout this guide query the following `instructors` table.
The dataset includes diverse departments, salary levels, academic ranks,
timestamp values, and null attributes to illustrate filtering edge cases:

```sql
CREATE TABLE instructors (
    instructor_id    INT PRIMARY KEY,
    first_name       VARCHAR(50)   NOT NULL,
    last_name        VARCHAR(50)   NOT NULL,
    academic_rank    VARCHAR(50)   NOT NULL,
    department_id    INT,
    salary           DECIMAL(10,2) NOT NULL,
    stipend_rate     DECIMAL(4,2),
    hire_date        TIMESTAMP     NOT NULL
);
```

### Table contents

| `instructor_id` | `first_name` | `last_name` | `academic_rank` | `department_id` | `salary` | `stipend_rate` | `hire_date` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | John | Hennessy | Professor | `10` | `180000.00` | `0.15` | `2023-01-15 09:30:00` |
| `102` | Marcus | Miller | Associate Professor | `10` | `145000.00` | `NULL` | `2023-01-31 16:45:00` |
| `103` | Andrea | Taylor | Professor | `20` | `160000.00` | `0.10` | `2023-02-01 08:00:00` |
| `104` | Sarah | Wilson | Assistant Professor | `20` | `125000.00` | `NULL` | `2023-02-15 11:15:00` |
| `105` | Evan | Wright | Lecturer | `30` | `95000.00` | `NULL` | `2023-03-01 10:00:00` |
| `106` | Frank | Clark | Visiting Lecturer | `NULL` | `85000.00` | `NULL` | `2023-03-15 14:20:00` |
| `107` | Grace | Hopper | Professor | `10` | `195000.00` | `0.20` | `2023-04-01 09:00:00` |
| `108` | Test | Account | Assistant Professor | `10` | `75000.00` | `NULL` | `2023-04-10 12:00:00` |

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
    instructor_id,
    first_name,
    last_name,
    salary
FROM instructors;
```

| `instructor_id` | `first_name` | `last_name` | `salary` |
| :--- | :--- | :--- | :--- |
| `101` | John | Hennessy | `180000.00` |
| `102` | Marcus | Miller | `145000.00` |
| `103` | Andrea | Taylor | `160000.00` |
| `104` | Sarah | Wilson | `125000.00` |
| `105` | Evan | Wright | `95000.00` |
| `106` | Frank | Clark | `85000.00` |
| `107` | Grace | Hopper | `195000.00` |
| `108` | Test | Account | `75000.00` |

#### Calculated expressions and column aliases

`SELECT` can evaluate arithmetic expressions, concatenate text strings, and
assign human-readable column aliases with the `AS` keyword:

```sql
SELECT 
    instructor_id,
    first_name || ' ' || last_name AS full_name,
    salary,
    ROUND(salary * 1.05, 2) AS projected_salary
FROM instructors
WHERE department_id = 20;
```

| `instructor_id` | `full_name` | `salary` | `projected_salary` |
| :--- | :--- | :--- | :--- |
| `103` | Andrea Taylor | `160000.00` | `168000.00` |
| `104` | Sarah Wilson | `125000.00` | `131250.00` |

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
    instructor_id,
    last_name,
    salary
FROM instructors
WHERE salary >= 145000.00;
```

#### Row evaluation trace

The database engine inspects each row against the predicate
`salary >= 145000.00`:

| `instructor_id` | `last_name` | Candidate salary | Evaluation of `salary >= 145000.00` | Action |
| :--- | :--- | :--- | :--- | :--- |
| `101` | Hennessy | `180000.00` | `180000.00 >= 145000.00` $\rightarrow$ `TRUE` | Kept in result |
| `102` | Miller | `145000.00` | `145000.00 >= 145000.00` $\rightarrow$ `TRUE` | Kept in result |
| `103` | Taylor | `160000.00` | `160000.00 >= 145000.00` $\rightarrow$ `TRUE` | Kept in result |
| `104` | Wilson | `125000.00` | `125000.00 >= 145000.00` $\rightarrow$ `FALSE` | Discarded |
| `105` | Wright | `95000.00` | `95000.00 >= 145000.00` $\rightarrow$ `FALSE` | Discarded |
| `106` | Clark | `85000.00` | `85000.00 >= 145000.00` $\rightarrow$ `FALSE` | Discarded |
| `107` | Hopper | `195000.00` | `195000.00 >= 145000.00` $\rightarrow$ `TRUE` | Kept in result |
| `108` | Account | `75000.00` | `75000.00 >= 145000.00` $\rightarrow$ `FALSE` | Discarded |

#### Resultant output

| `instructor_id` | `last_name` | `salary` |
| :--- | :--- | :--- |
| `101` | Hennessy | `180000.00` |
| `102` | Miller | `145000.00` |
| `103` | Taylor | `160000.00` |
| `107` | Hopper | `195000.00` |

### Logical operators and operator precedence

Combine or invert conditions using `AND`, `OR`, and `NOT`:

- `AND` produces `TRUE` only when both operands evaluate to `TRUE`.
- `OR` produces `TRUE` when at least one operand evaluates to `TRUE`.
- `NOT` reverses the truth value: `TRUE` becomes `FALSE`, and `FALSE` becomes `TRUE`.

`AND` binds more tightly than `OR`. For example, the engine evaluates
`A OR B AND C` as `A OR (B AND C)`. Omitting parentheses causes logic bugs.

Consider this query with intended grouping:

```sql
SELECT 
    instructor_id,
    last_name,
    department_id,
    salary
FROM instructors
WHERE (department_id = 10 OR department_id = 20)
  AND salary <= 150000.00;
```

#### Comparison of precedence behaviors

The table below contrasts the explicit grouped condition with the condition
without parentheses `department_id = 10 OR department_id = 20 AND salary <= 150000.00`:

| `instructor_id` | `department_id` | `salary` | Grouped condition | Condition without parentheses |
| :--- | :--- | :--- | :--- | :--- |
| `101` | `10` | `180000.00` | `TRUE` and `FALSE` $\rightarrow$ `FALSE` - discard | `TRUE` or `FALSE` $\rightarrow$ `TRUE` - leak |
| `102` | `10` | `145000.00` | `TRUE` and `TRUE` $\rightarrow$ `TRUE` - retain | `TRUE` or `TRUE` $\rightarrow$ `TRUE` - retain |
| `103` | `20` | `160000.00` | `TRUE` and `FALSE` $\rightarrow$ `FALSE` - discard | `FALSE` or `FALSE` $\rightarrow$ `FALSE` - discard |
| `104` | `20` | `125000.00` | `TRUE` and `TRUE` $\rightarrow$ `TRUE` - retain | `FALSE` or `TRUE` $\rightarrow$ `TRUE` - retain |
| `105` | `30` | `95000.00` | `FALSE` and `TRUE` $\rightarrow$ `FALSE` - discard | `FALSE` or `FALSE` $\rightarrow$ `FALSE` - discard |
| `107` | `10` | `195000.00` | `TRUE` and `FALSE` $\rightarrow$ `FALSE` - discard | `TRUE` or `FALSE` $\rightarrow$ `TRUE` - leak |
| `108` | `10` | `75000.00` | `TRUE` and `TRUE` $\rightarrow$ `TRUE` - retain | `TRUE` or `TRUE` $\rightarrow$ `TRUE` - retain |

The condition without parentheses unintentionally returns every instructor in
department `10`, regardless of salary. The grouped query produces the
intended result:

| `instructor_id` | `last_name` | `department_id` | `salary` |
| :--- | :--- | :--- | :--- |
| `102` | Miller | `10` | `145000.00` |
| `104` | Wilson | `20` | `125000.00` |
| `108` | Account | `10` | `75000.00` |

### Inclusive range evaluation with `BETWEEN`

The `BETWEEN` operator evaluates whether a candidate expression falls within
a continuous range, inclusive of both endpoint values:

```sql
SELECT 
    instructor_id,
    last_name,
    salary
FROM instructors
WHERE salary BETWEEN 125000.00 AND 160000.00;
```

This predicate is equivalent to:

```sql
WHERE salary >= 125000.00 AND salary <= 160000.00
```

#### Resultant output

Because both boundary values are inclusive, the query retains rows with
salaries of exactly `125000.00` and `160000.00`:

| `instructor_id` | `last_name` | `salary` |
| :--- | :--- | :--- |
| `102` | Miller | `145000.00` |
| `103` | Taylor | `160000.00` |
| `104` | Wilson | `125000.00` |

> [!NOTE]
> `BETWEEN` requires the lower bound first: `BETWEEN low AND high`. If you
> write `BETWEEN 160000.00 AND 125000.00`, the condition expands to
> `salary >= 160000.00 AND salary <= 125000.00`, which always evaluates to
> `FALSE` and returns zero rows.

### Discrete set membership with `IN`

The `IN` operator evaluates whether a scalar value matches any element in an
explicit list of expressions:

```sql
SELECT 
    instructor_id,
    last_name,
    department_id
FROM instructors
WHERE department_id IN (20, 30);
```

The database engine expands this predicate into an equality disjunction:

```sql
WHERE department_id = 20 OR department_id = 30
```

#### Resultant output

| `instructor_id` | `last_name` | `department_id` |
| :--- | :--- | :--- |
| `103` | Taylor | `20` |
| `104` | Wilson | `20` |
| `105` | Wright | `30` |

### Pattern matching with `LIKE`

The `LIKE` operator evaluates character string expressions against a wildcard
pattern. Standard SQL defines two wildcard characters:

- Percent wildcard `%`: matches zero or more arbitrary characters.
- Single-character wildcard `_`: matches exactly one arbitrary character.

#### Pattern matching examples

```sql
-- Matches academic ranks containing 'Professor' anywhere in the string
SELECT instructor_id, last_name, academic_rank
FROM instructors
WHERE academic_rank LIKE '%Professor%';
```

| `instructor_id` | `last_name` | `academic_rank` | Match explanation |
| :--- | :--- | :--- | :--- |
| `101` | Hennessy | Professor | Exact suffix match |
| `102` | Miller | Associate Professor | Suffix match |
| `103` | Taylor | Professor | Exact suffix match |
| `104` | Wilson | Assistant Professor | Suffix match |
| `107` | Hopper | Professor | Exact suffix match |

```sql
-- Matches last names where the second character is 'e' (Hennessy)
SELECT instructor_id, last_name, academic_rank
FROM instructors
WHERE last_name LIKE '_e%';
```

| `instructor_id` | `last_name` | `academic_rank` | Match explanation |
| :--- | :--- | :--- | :--- |
| `101` | Hennessy | Professor | Second character is `e` |

## Step-by-step complete filtering trace

Consider a compound query that applies multiple simultaneous predicates
across distinct data types:

```sql
SELECT 
    instructor_id,
    first_name,
    last_name,
    academic_rank,
    department_id,
    salary
FROM instructors
WHERE department_id IN (10, 20)
  AND salary BETWEEN 120000.00 AND 190000.00
  AND (academic_rank LIKE '%Professor%' OR academic_rank LIKE '%Lecturer%')
  AND last_name NOT LIKE 'Account%'
ORDER BY instructor_id;
```

### Complete evaluation matrix

The database engine evaluates candidate rows through each filter predicate:

| `instructor_id` | Department in list | Salary range | Rank match | Not Account | Final decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | `10`: `TRUE` | `180000`: `TRUE` | Professor: `TRUE` | Hennessy: `TRUE` | Retained |
| `102` | `10`: `TRUE` | `145000`: `TRUE` | Associate Professor: `TRUE` | Miller: `TRUE` | Retained |
| `103` | `20`: `TRUE` | `160000`: `TRUE` | Professor: `TRUE` | Taylor: `TRUE` | Retained |
| `104` | `20`: `TRUE` | `125000`: `TRUE` | Assistant Professor: `TRUE` | Wilson: `TRUE` | Retained |
| `105` | `30`: `FALSE` | `95000`: `FALSE` | Lecturer: `TRUE` | Wright: `TRUE` | Discarded: department, salary |
| `106` | `NULL`: `UNKNOWN` | `85000`: `FALSE` | Visiting Lecturer: `TRUE` | Clark: `TRUE` | Discarded: department unknown, salary |
| `107` | `10`: `TRUE` | `195000`: `FALSE` | Professor: `TRUE` | Hopper: `TRUE` | Discarded: salary exceeds range |
| `108` | `10`: `TRUE` | `75000`: `FALSE` | Assistant Professor: `TRUE` | Account: `FALSE` | Discarded: salary below range, account |

### Final output table

| `instructor_id` | `first_name` | `last_name` | `academic_rank` | `department_id` | `salary` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `101` | John | Hennessy | Professor | `10` | `180000.00` |
| `102` | Marcus | Miller | Associate Professor | `10` | `145000.00` |
| `103` | Andrea | Taylor | Professor | `20` | `160000.00` |
| `104` | Sarah | Wilson | Assistant Professor | `20` | `125000.00` |

## Common pitfalls

When writing SQL filter conditions, watch for these common mistakes:

### Null values in `NOT IN` predicates

A query using `NOT IN` returns zero rows if the comparison list or nested query
contains a null value.

Consider this query:

```sql
SELECT instructor_id, last_name
FROM instructors
WHERE department_id NOT IN (20, 30, NULL);
```

#### Predicate expansion under three-valued logic

SQL expands `x NOT IN (a, b, c)` as `NOT (x = a OR x = b OR x = c)`. Applying
De Morgan's laws converts this expression into:

```sql
WHERE (department_id <> 20)
  AND (department_id <> 30)
  AND (department_id <> NULL)
```

Because comparing any scalar value to null yields `UNKNOWN`, the term
`(department_id <> NULL)` always evaluates to `UNKNOWN`:

$$\text{TRUE} \land \text{TRUE} \land \text{UNKNOWN} \implies \text{UNKNOWN}$$

Because a `WHERE` clause filters out candidate rows that don't evaluate
to `TRUE`, the engine discards every single row, returning an empty result set.

#### Safe implementation alternatives

Use `NOT EXISTS` with a correlated nested query or explicitly filter null
values in the inner query:

```sql
-- Safe option 1: Filter NULL in nested query
SELECT instructor_id, last_name
FROM instructors
WHERE department_id NOT IN (
    SELECT department_id
    FROM departments
    WHERE department_id IS NOT NULL
);

-- Safe option 2: Use NOT EXISTS
SELECT i.instructor_id, i.last_name
FROM instructors AS i
WHERE NOT EXISTS (
    SELECT 1
    FROM departments AS d
    WHERE d.department_id = i.department_id
);
```

### Date and timestamp boundary truncation

Filtering timestamp columns with date-only literals using `BETWEEN` omits
events that occur later during the ending day:

```sql
-- Flawed query: excludes events after midnight on 2023-01-31
SELECT instructor_id, last_name, hire_date
FROM instructors
WHERE hire_date BETWEEN '2023-01-01' AND '2023-01-31';
```

The database engine casts the string `'2023-01-31'` to `2023-01-31 00:00:00`.
Consequently, the engine excludes Marcus Miller with hire timestamp
`2023-01-31 16:45:00` because `16:45:00` exceeds midnight.

#### Safe half-open interval pattern

Use a half-open interval with `>= start` and `< end_plus_one` to capture every
fractional millisecond of the final target day:

```sql
SELECT instructor_id, last_name, hire_date
FROM instructors
WHERE hire_date >= '2023-01-01'
  AND hire_date <  '2023-02-01';
```

| `instructor_id` | `last_name` | `hire_date` | Inclusion explanation |
| :--- | :--- | :--- | :--- |
| `101` | Hennessy | `2023-01-15 09:30:00` | Within range |
| `102` | Miller | `2023-01-31 16:45:00` | Correctly captured on target date |

### Leading wildcards and index range scans

A predicate is search-argumentable, known as `` `SARGable` ``, when the database
query optimizer can navigate a B-tree index directly to locate candidate rows.

- Search-argumentable prefix: `last_name LIKE 'He%'`. The B-tree root and branch
  nodes search by the leading prefix `'He'` with $O(\log N)$ index seeks.
- Non-search-argumentable pattern: `academic_rank LIKE '%Professor'`. A leading
  wildcard forces the database engine to execute an $O(N)$ full table scan
  because the index key order can't determine which entries end with
  `'Professor'`.

When querying high-cardinality text columns, evaluate database full-text
search indices or trigram indexes such as `` `pg_trgm` `` in `PostgreSQL` rather
than relying on leading wildcards.

## What's next

- Learn aggregation functions and `GROUP BY` operations in
  [Basic aggregations and grouping](/sql/basic-aggregations-and-grouping).
- Master relational join types and anti-semi-joins in
  [Fundamental joins](/sql/fundamental-joins).
- Understand null handling, `COALESCE`, and `CASE` expressions in
  [Conditional logic and null handling](/sql/conditional-logic-and-null-handling).
