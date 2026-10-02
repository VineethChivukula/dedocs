# Relational model concepts

## Overview

The relational model organizes data into tables and uses constraints to help
maintain data integrity. This model is the foundation of relational database
management systems, such as PostgreSQL, Oracle Database, and SQL Server.

This guide introduces the core parts of the relational model and shows how
they work together in a SQL schema. It also describes common design and query
pitfalls.

## Core concepts

### Tables

A table, also called a relation, stores data about a specific type of entity or
process, such as employees, orders, and invoices. A table has a defined schema that
describes its columns and constraints.

Each table contains:

- **Rows**, which represent individual records.
- **Columns**, which represent attributes of those records.

### Rows

A row, also called a tuple or record, represents one instance of the entity
described by the table. For example, a row in an `Employees` table can
represent one employee.

In a well-designed table, each row contains one value for each applicable
column. The table's constraints determine which values the database requires
and which values must be unique.

### Columns

A column, also called an attribute or field, describes one property of every
row in a table. Each column has a data type, such as `INTEGER`, `VARCHAR`,
`DATE`, or `FLOAT`. The data type limits the values that the column can store.

For example, an `Email` column might use `VARCHAR(255)`, while an
`EmployeeID` column might use `INTEGER`.

### Primary keys

A primary key uniquely identifies each row in a table. A primary key can
consist of one column or multiple columns. A key with multiple columns is a
composite key.

A primary key has these properties:

- Each key value is unique within the table.
- A key column can't contain `NULL`.
- A table can have only one primary key constraint.

Use a primary key when other tables or applications need a stable way to
identify a record.

### Foreign keys

A foreign key is a column or group of columns in one table that references a
key in another table. The table that contains the foreign key is the child
table. The referenced table is the parent table.

Foreign keys:

- Define relationships between tables.
- Support queries that combine tables with `JOIN`.
- Enforce referential integrity.

Referential integrity prevents a child row from referencing a parent key that
doesn't exist. A foreign key can contain `NULL` unless you also declare the
column as `NOT NULL`. A `NULL` foreign key represents an absent relationship.
It doesn't reference a parent row.

### Unique constraints

A unique constraint requires values in a column, or combination of columns, to
be distinct within a table. A table can have multiple unique constraints.

The treatment of `NULL` values in a unique constraint varies by database
engine. If a column must both contain a value and be unique, declare it with
both `NOT NULL` and `UNIQUE`.

### `NOT NULL` constraints

A `NOT NULL` constraint requires a column to contain a value. The database
rejects an `INSERT` or `UPDATE` operation that would store `NULL` in that
column.

Use `NOT NULL` for attributes that every record must have, such as an
employee's first and last name.

## Example schema

The following schema demonstrates tables, rows, columns, primary keys,
foreign keys, unique constraints, and `NOT NULL` constraints:

```sql
CREATE TABLE Departments (
  DepartmentID INTEGER PRIMARY KEY,
  DepartmentName VARCHAR(100) NOT NULL UNIQUE
);
```

```sql
CREATE TABLE Employees (
  EmployeeID INTEGER PRIMARY KEY,
  Email VARCHAR(255) NOT NULL UNIQUE,
  FirstName VARCHAR(50) NOT NULL,
  LastName VARCHAR(50) NOT NULL,
  DepartmentID INTEGER,
  CONSTRAINT fk_employees_department
    FOREIGN KEY (DepartmentID)
    REFERENCES Departments(DepartmentID)
);
```

In this example:

- `Departments` and `Employees` are tables.
- Each column declares an attribute and a data type.
- Each row in `Employees` represents one employee.
- `DepartmentID` uniquely identifies a department.
- `EmployeeID` uniquely identifies an employee.
- `Employees.DepartmentID` references `Departments.DepartmentID`.
- `Email` must be present and unique.
- `FirstName` and `LastName` must be present.

For example, the following statements insert a department and an employee:

```sql
INSERT INTO Departments (DepartmentID, DepartmentName)
VALUES (10, 'Engineering');
```

```sql
INSERT INTO Employees (
  EmployeeID,
  Email,
  FirstName,
  LastName,
  DepartmentID
)
VALUES (
  101,
  'alex@example.com',
  'Alex',
  'Rivera',
  10
);
```

An insert that uses `DepartmentID = 99` fails if no department with that key
exists. This behavior preserves referential integrity.

## Common pitfalls

### Missing indexes on foreign keys

Defining a foreign key doesn't necessarily create an index on the child
column. Without an appropriate index, joins and parent-row updates or deletes
can require more work, especially in large tables.

Review the indexes on frequently queried foreign key columns. The exact index
requirements and locking behavior depend on the database engine and the
queries that the app runs.

### Different `NULL` behavior in unique constraints

Database engines don't all handle `NULL` values in unique constraints in the
same way. For example, PostgreSQL and Oracle generally allow multiple `NULL`
values in a unique column, while SQL Server traditionally allows only one
`NULL` value for a single-column unique constraint.

If the column must contain a value and every value must be unique, use:

```sql
Email VARCHAR(255) NOT NULL UNIQUE
```

Check your database engine's documentation when you need different behavior.

### Foreign keys that allow `NULL`

A foreign key that allows `NULL` lets a row have no related parent. This can be
valid for an optional relationship, but it can also produce missing rows when
you use an `INNER JOIN`.

Declare the foreign key as `NOT NULL` when every child row must have a parent:

```sql
DepartmentID INTEGER NOT NULL,
CONSTRAINT fk_employees_department
  FOREIGN KEY (DepartmentID)
  REFERENCES Departments(DepartmentID)
```

Use a `LEFT JOIN` when you need to include child rows that don't have a
related parent.

### Natural keys and surrogate keys

A natural key uses a business value, such as a stock-keeping unit or
government-issued
identifier, to identify a row. A surrogate key is an identifier created for
the database, such as an auto-incrementing integer.

Natural keys can change when business rules or external systems change. A
surrogate key can provide a stable internal identifier, while a unique
constraint can preserve the uniqueness of the corresponding business value.
Choose the approach that matches the data lifecycle and the requirements of
your app.

## Key takeaways

- Use tables to organize related data into entities.
- Use primary keys to identify rows.
- Use foreign keys to model relationships and enforce referential integrity.
- Use `UNIQUE` and `NOT NULL` constraints to express data requirements.
- Check how your database engine handles `NULL` values and indexes.
- Treat key design as part of the data model, not only as an implementation
  detail.
