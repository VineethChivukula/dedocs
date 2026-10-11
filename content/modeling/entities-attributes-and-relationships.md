# Entities, attributes, and relationships

## Overview

Entities, attributes, and relationships form the foundational building blocks of database modeling. They define how systems structure real-world business domains, capture transactional activity, and map entity interactions across relational engines and analytical data warehouses.

This guide explains:

- Entity types, attribute classifications, and key mechanics.
- Relationship cardinality rules: 1:1, 1:N, and many-to-many.
- Relationship degrees, participation constraints, and Crow's foot notation.
- Enhanced entity-relationship concepts, such as generalization, specialization, and aggregation.
- The mechanics of Online Transaction Processing (OLTP) junction tables versus dimensional bridge tables.
- Weighting factors and ragged hierarchy navigation in analytical warehouses.
- Common join anomalies, including row explosion, the fan trap, the chasm trap, and relational shredding.

## Core building blocks

Every relational schema organizes data using three primary abstractions: entities, attributes, and relationships.

```mermaid
---
title: Relational modeling building blocks
---
flowchart LR
    Entity["Entity<br/>Table / Object<br/>(Customer)"]
    Attribute["Attributes<br/>Columns / Properties<br/>(Email, Name, Phone)"]
    Relationship["Relationship<br/>Foreign Key / Junction<br/>(Places Order)"]

    Entity --- Attribute
    Entity -->|participates in| Relationship
```

### Entities and entity sets

An entity is a discrete, identifiable real-world object, concept, or event about which a system stores data. In a Relational Database Management System (RDBMS), an entity maps to a table where each row represents a unique instance of that entity.

A collection of similar entities forms an entity set. For example, all students in a university constitute a student entity set.

Data modeling distinguishes two categories of entities:

- **Strong entities**: exist independently of other domain entities. A strong entity possesses a distinct primary key that uniquely identifies every instance. For example, a customer, student, or building is a strong entity.
- **Weak entities**: depend on the existence of an identifying parent entity for identity. A weak entity lacks a primary key of its own. It relies on a partial key, or discriminator, combined with the primary key of the parent entity to establish uniqueness. For example, an order line item can't exist without an order, and a course section can't exist without its parent course.

```mermaid
---
title: Strong entity versus weak entity
---
flowchart LR
    Course["Strong Entity<br/>[Course]<br/>Primary Key: course_id"]
    Section["Weak Entity<br/>[[CourseSection]]<br/>Discriminator: section_number<br/>Composite Key: (course_id, section_number)"]

    Course -->|"identifies (1..N)"| Section
```

### Attributes and data characteristics

An attribute describes a property, characteristic, or measurement belonging to an entity. In a physical database, attributes map to columns with assigned data types.

Attributes fall into distinct structural classifications:

- **Simple or atomic attributes**: store indivisible values that can't divide into smaller semantic units, such as a status code, an account balance, or a currency code.
- **Composite attributes**: consist of multiple logical sub-elements. For example, a street address decomposes into street, city, state, and postal code. In relational databases, designers flatten composite attributes into separate columns.
- **Multi-valued attributes**: hold multiple values for a single entity instance, such as several phone numbers, emergency contacts, or skill tags. Relational databases normalize multi-valued attributes into independent child tables connected through foreign keys to maintain first normal form.
- **Derived attributes**: represent calculated values computed from stored attributes or runtime queries rather than static disk values. For example, age derives from `birth_date`, and line total derives from `quantity * unit_price`.
- **Key attributes**: uniquely identify individual entity instances within an entity set, such as `customer_id` or `order_number`.

```mermaid
---
title: Taxonomy of entity attributes
---
flowchart TD
    Entity["Employee Entity"]
    A1["Simple: status_code"]
    A2["Composite: full_name<br/>(first_name, last_name)"]
    A3["Multi-valued: phone_numbers<br/>(home, mobile, pager)"]
    A4["Derived: years_of_service<br/>(from hire_date)"]
    A5["Key: employee_id"]

    Entity --- A1
    Entity --- A2
    Entity --- A3
    Entity --- A4
    Entity --- A5
```

### Relational keys

In relational modeling, keys enforce row identity, establish referential integrity, and maintain uniqueness constraints:

- **Super keys**: any combination of columns that uniquely identifies a row in a table. Super keys can contain extra, non-essential columns.
- **Candidate keys**: a minimal super key with no redundant columns. Removing any column from a candidate key destroys its uniqueness property.
- **Primary key**: the candidate key selected by the database architect as the official identifier for the entity. Primary keys must be unique, non-null, and immutable.
- **Alternate keys**: candidate keys not chosen as the primary key. Engines enforce alternate keys using `UNIQUE` constraints.
- **Composite keys**: primary keys or candidate keys consisting of two or more columns.
- **Foreign keys**: columns that reference a primary key or unique key in another table, enforcing referential integrity.

## Cardinality and multiplicity

The relationship between two entities defines their cardinality rule, or multiplicity. Cardinality specifies the numerical constraints governing how many instances of one entity can associate with instances of another entity.

```mermaid
---
title: Fundamental relationship cardinalities
---
flowchart LR
    subgraph OTO ["One-to-One (1:1)"]
        direction TB
        User[User] <-->|Shared PK or Unique FK| Profile[Profile]
    end

    subgraph OTM ["One-to-Many (1:N)"]
        direction TB
        Building[Building] -->|FK on Child Table| Apartment[Apartments]
    end

    subgraph MTM ["Many-to-Many (M:N)"]
        direction TB
        Student[Student] <-->|Junction / Bridge Table| Course[Course]
    end
```

### One-to-one relationships

In a one-to-one relationship, exactly one instance of entity A associates with at most one instance of entity B, and vice versa.

#### Implementation strategies

Relational engines implement one-to-one relationships using two physical designs:

1. **Single consolidated table**: when two entities share the same lifecycle, creation time, and access patterns, combine them into one table. Combining entities eliminates join overhead.
2. **Split tables with a shared primary key or unique foreign key**: separate the child entity into its own table when it contains optional attributes, security-sensitive columns, or large data payloads.

The child table references the parent table through one of two mechanisms:

- **Shared primary key**: the child table declares its primary key column as both its `PRIMARY KEY` and a `FOREIGN KEY` referencing the parent table.
- **Unique foreign key**: the child table declares a foreign key column with a `UNIQUE` constraint and a `NOT NULL` constraint.

```sql
-- Split table implementation using a shared primary key
CREATE TABLE users (
    user_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
    user_id       BIGINT PRIMARY KEY, -- Shared PK and FK
    date_of_birth DATE,
    avatar_url    VARCHAR(500),
    bio           TEXT,
    CONSTRAINT fk_user_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
);
```

### One-to-many relationships

In a one-to-many relationship, one instance of entity A associates with zero, one, or multiple instances of entity B. However, each instance of entity B references at most one instance of entity A. The reverse association forms a many-to-one relationship.

#### Implementation strategy

Relational databases implement one-to-many relationships by placing the primary key of the parent entity as a foreign key column in the child entity table.

Common examples include:

- A building contains multiple apartments, where each apartment stores a `building_id` foreign key.
- A department employs multiple employees, where each employee references a `department_id`.
- A customer purchase order contains multiple line items, where each line item references an `order_id`.

```sql
CREATE TABLE departments (
    department_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_title    VARCHAR(100) NOT NULL,
    credits         INTEGER NOT NULL CHECK (credits > 0),
    department_id   INTEGER NOT NULL, -- Foreign key establishes 1:N
    CONSTRAINT fk_courses_dept
        FOREIGN KEY (department_id)
        REFERENCES departments (department_id)
        ON DELETE RESTRICT
);

-- Index foreign key to support efficient parent searches and joins
CREATE INDEX idx_courses_department_id ON courses(department_id);
```

### Many-to-many relationships

In a many-to-many relationship, multiple instances of entity A associate with multiple instances of entity B, and multiple instances of entity B associate with multiple instances of entity A.

Common examples include:

- Students enroll in multiple courses, and each course contains multiple students.
- Tenants rent multiple apartments over time, and an apartment houses multiple tenants.
- Patients receive multiple medical diagnoses during hospital visits, and each diagnosis applies to multiple patients.

#### Relational constraint

A relational table can't link a many-to-many relationship directly using a single foreign key column. Storing comma-separated identifiers in a single column violates first normal form, prevents index searches, and destroys referential integrity. Storing repeated parent rows causes massive data redundancy and update anomalies.

Relational databases resolve many-to-many relationships by decomposing them into two one-to-many relationships using an intermediate associative table.

```mermaid
---
title: Decomposing many-to-many relationships
---
flowchart LR
    Student["Student<br/>(Entity A)"]
    Course["Course<br/>(Entity B)"]
    Enrollment["StudentCourseEnrollments<br/>(Associative Junction Table)<br/>PK: (student_id, course_id)"]

    Student -->|"1 : N"| Enrollment
    Course -->|"1 : N"| Enrollment
```

## Relationship degrees and participation

Beyond basic cardinality, relationships possess structural properties that govern how entities interact.

### Relationship degrees

The degree of a relationship indicates the number of participating entities:

- **Recursive relationships**: involve a single entity associating with itself, also called a `unary` relationship. Examples include organizational reporting structures, where an employee references a manager within the same table, and category trees.
- **Binary relationships**: involve two distinct entities. Binary associations represent the vast majority of operational database interactions.
- **Ternary relationships**: involve three distinct entities simultaneously. For example, a physician prescribes a specific drug treatment to a patient, linking `Physician`, `Patient`, and `Medication` in an atomic relationship.
- **N-ary relationships**: involve four or more entities simultaneously. Teams typically decompose n-ary relationships into multiple binary associations using intermediate associative tables.

```mermaid
---
title: Degrees of database relationships
---
flowchart LR
    subgraph Recursive ["Recursive (Unary)"]
        direction TB
        Emp[Employee] -->|supervises| Emp
    end

    subgraph Binary ["Binary"]
        direction TB
        Cust[Customer] -->|places| Ord[Order]
    end

    subgraph Ternary ["Ternary"]
        direction TB
        Phys[Physician] --- Prescribe{Prescribes}
        Pat[Patient] --- Prescribe
        Med[Medication] --- Prescribe
    end
```

### Participation constraints

Participation constraints specify whether an entity instance must participate in a relationship:

- **Total participation**: every instance of an entity must participate in the relationship, creating an existence dependency. In an ER diagram, double lines represent total participation. For example, every `OrderLineItem` must link to an existing `Order`.
- **Partial participation**: some instances of an entity can exist without participating in the relationship. A single line represents partial participation. For example, an employee can exist without managing a department.

### Crow's foot notation

Crow's foot notation uses visual symbols at relationship line endpoints to represent minimum and maximum cardinality:

| Symbol | Notation name | Structural rule |
| :--- | :--- | :--- |
| `\|\|` | Mandatory one | Minimum one, maximum one: exactly one instance |
| `\|o` | Optional one | Minimum zero, maximum one: zero or one instance |
| `>\|` | Mandatory many | Minimum one, maximum many: one or more instances |
| `>o` | Optional many | Minimum zero, maximum many: zero, one, or more instances |

## Enhanced entity-relationship concepts

Enhanced Entity-Relationship (EER) modeling provides abstraction techniques for complex corporate hierarchies and entity specialization.

### Generalization and specialization

- **Generalization**: a bottom-up modeling process. It identifies shared attributes and behaviors across multiple specialized entities and unifies them into a generalized super-entity. For example, unifying `UndergraduateStudent` and `GraduateStudent` into `Student`.
- **Specialization**: a top-down modeling process. It partitions a generalized entity into distinct sub-entities based on business conditions. For example, specializing an `Account` entity into `CheckingAccount` and `SavingsAccount`.

```mermaid
---
title: Generalization and specialization hierarchy
---
flowchart TD
    Person["Person (Super-entity)<br/>Attributes: person_id, name, email"]
    ISA{"IS-A"}
    Student["Student (Sub-entity)<br/>Attributes: gpa, major"]
    Instructor["Instructor (Sub-entity)<br/>Attributes: salary, academic_rank"]

    Person --- ISA
    ISA --- Student
    ISA --- Instructor
```

### Attribute inheritance

In an EER hierarchy, specialized sub-entities inherit all attributes, primary keys, and relationships from their parent super-entity. A sub-entity table stores only attributes unique to its specialization, using the parent primary key as its own primary key and foreign key.

### Aggregation

Aggregation models a relationship between two entities as a higher-level entity set. This allows the relationship itself to establish associations with third entities without introducing messy ternary cross-products.

For example, when an employee works on a project, that operational assignment can require specific technical hardware. Aggregation treats the `WorksOn` relationship between `Employee` and `Project` as a distinct unit, linking it directly to `HardwareEquipment`.

```mermaid
---
title: Aggregation pattern
---
flowchart LR
    subgraph Assignment ["Aggregated Unit: WorksOn"]
        direction LR
        Employee[Employee] --- WorksOn{Works On} --- Project[Project]
    end

    Assignment --- Requires{Requires} --- Equipment[HardwareEquipment]
```

## Real-world university enterprise schema

The following Entity Relationship Diagram (ERD) demonstrates a comprehensive enterprise schema containing 11 entities, diverse cardinality rules, composite keys, and inheritance relationships:

```mermaid
---
title: University enterprise ERD
---
erDiagram
    UNIVERSITY ||--|{ DEPARTMENT : "has"
    DEPARTMENT ||--o| DEPARTMENT_HEAD : "led by"
    PROFESSOR ||--|| DEPARTMENT_HEAD : "appointed as"
    DEPARTMENT ||--|{ COURSE : "offers"
    PROFESSOR ||--o{ COURSE : "teaches"
    STUDENT }o--o{ COURSE : "enrolls in"
    COURSE ||--|{ COURSE_SECTION : "divided into"
    COURSE_SECTION ||--o{ ENROLLMENT : "contains"
    STUDENT ||--o{ ENROLLMENT : "registers for"
    COURSE ||--o{ ASSIGNMENT : "assigns"
    STUDENT ||--o{ SUBMISSION : "completes"
    ASSIGNMENT ||--|{ SUBMISSION : "receives"
    STUDENT o|--|| STUDENT_PROFILE : "maintains"

    UNIVERSITY {
        int university_id PK
        string name
        string campus_location
        int founded_year
    }

    DEPARTMENT {
        int department_id PK
        int university_id FK
        string name
        string building_code
    }

    DEPARTMENT_HEAD {
        int head_id PK
        int department_id FK
        int professor_id FK
        date appointed_date
    }

    PROFESSOR {
        int professor_id PK
        int department_id FK
        string name
        string email
        string academic_rank
    }

    STUDENT {
        int student_id PK
        string name
        string email
        date admission_date
    }

    STUDENT_PROFILE {
        int profile_id PK
        int student_id FK
        string permanent_address
        string emergency_contact
        decimal current_gpa
    }

    COURSE {
        int course_id PK
        int department_id FK
        int professor_id FK
        string title
        int credits
    }

    COURSE_SECTION {
        int section_id PK
        int course_id FK
        string semester_code
        string classroom_number
        int seat_capacity
    }

    ENROLLMENT {
        int enrollment_id PK
        int student_id FK
        int section_id FK
        string final_grade
    }

    ASSIGNMENT {
        int assignment_id PK
        int course_id FK
        string title
        date due_date
        int max_points
    }

    SUBMISSION {
        int submission_id PK
        int assignment_id FK
        int student_id FK
        timestamp submitted_at
        int awarded_score
    }
```

### Relationship mechanics breakdown

The enterprise model illustrates fundamental relational principles:

1. **`UNIVERSITY` to `DEPARTMENT` with `||--|{`**: mandatory one-to-many. A university must establish at least one academic department, and each department belongs to a single parent university.
2. **`DEPARTMENT` to `DEPARTMENT_HEAD` with `||--o|`**: optional one-to-one. A department has at most one head, but a newly established department can operate temporarily without an appointed head.
3. **`PROFESSOR` to `DEPARTMENT_HEAD` with `||--||`**: mandatory one-to-one. A department head must hold an active faculty appointment as a professor.
4. **`PROFESSOR` to `COURSE` with `||--o{`**: optional one-to-many. A professor teaches zero, one, or multiple courses, accommodating faculty on sabbatical.
5. **`COURSE` to `COURSE_SECTION` with `||--|{`**: mandatory one-to-many. A course divides into one or more classroom sections for semester scheduling.
6. **`STUDENT` to `STUDENT_PROFILE` with `o|--||`**: optional-to-mandatory one-to-one. A profile requires a valid student, but incoming students can delay completing profile details.

## Junction tables versus dimensional bridge tables

Relational transactional systems and analytical data warehouses both use intermediate tables to resolve many-to-many relationships, but they serve different operational goals.

| Feature / Dimension | Relational junction table | Dimensional bridge table |
| :--- | :--- | :--- |
| **System environment** | Online Transaction Processing (OLTP) | Online Analytical Processing (OLAP) |
| **Core purpose** | Enforce normalization and referential integrity | Connect facts to multi-valued dimensions |
| **Primary key** | Composite key of foreign keys | Bridge group surrogate key or composite key |
| **Payload attributes** | Relationship properties, such as start dates, role titles, or grades | Numerical weighting factors and path levels |
| **Aggregation method** | Direct joins with standard aggregates | Weighted allocations and multi-pass queries |

```mermaid
---
title: Junction tables versus dimensional bridge tables
---
flowchart TD
    subgraph OLTP ["OLTP Junction Table (Transaction Integrity)"]
        direction LR
        S[Student] --- E["StudentCourseEnrollment<br/>PK: (student_id, course_id)<br/>Payload: grade, enroll_date"] --- C[Course]
    end

    subgraph OLAP ["OLAP Dimensional Bridge Table (Analytical Fact Allocation)"]
        direction LR
        F["FactBilling<br/>Metric: billed_amount<br/>FK: diagnosis_group_id"] --> B["BridgeDiagnosisGroup<br/>WeightingFactor: 0.60, 0.40"] --> D["DimDiagnosis<br/>Attribute: ICDCode"]
    end
```

### Relational junction tables

In transactional databases, an associative junction table converts an unconstrained many-to-many relationship into two one-to-many relationships.

#### Structural characteristics

- **Foreign key references**: contains foreign key columns referencing the primary keys of both participating tables.
- **Composite primary key**: declares a composite primary key spanning both foreign keys, such as `PRIMARY KEY (student_id, course_id)`. The composite primary key prevents duplicate relationship pairings.
- **Relationship attributes**: stores payload attributes that belong strictly to the association itself rather than either entity independently. Examples include `enrollment_date` and `final_grade` in a course enrollment table, or `salary` and `effective_date` in an employee role history table.

### Dimensional bridge tables

In analytical data warehouses following dimensional modeling practices, standard star schemas connect fact tables to single-valued dimensions. A fact table record contains foreign keys that resolve to one customer, one date, and one store.

However, real-world business events frequently associate with an open-ended collection of dimension values simultaneously:

- A healthcare insurance claim links to multiple medical diagnoses.
- A commercial bank account links to multiple joint account holders.
- An insurance policy covers multiple drivers on a single vehicle.

A dimensional bridge table, or helper table, bridges the gap between a single fact record and a multi-valued dimension.

#### Weighting factors

When an analytical query joins a fact table directly to a multi-valued dimension through an unweighted bridge table, the database replicates the fact row for every matching dimension member. Standard aggregates such as `SUM(billed_amount)` double-count revenue.

To solve double-counting, bridge tables include a numerical weighting factor. A weighting factor is a fractional decimal between 0.01 and 1.00, where the weights for all members in a given group sum to 1.00.

Weighting factors enable two distinct analytical reporting patterns:

- **Correctly weighted reports**: the query multiplies the additive fact metric by the weighting factor: `SUM(fact_amount * weighting_factor)`. This distributes revenue or costs accurately across dimension members without double-counting.
- **Impact analysis reports**: the query omits the weighting factor and aggregates the raw fact metric: `SUM(fact_amount)`. This reveals the total transaction volume touched by any specific dimension member.

#### Ragged hierarchies

Bridge tables also resolve ragged, variable-depth recursive hierarchies without requiring expensive recursive queries. Examples include corporate parent-subsidiary structures and manufacturing bills of materials.

A hierarchy bridge table stores one row for every ancestor-descendant pairing in the tree. Each row includes a depth indicator and a flag marking leaf nodes. Reporting queries join directly to the bridge table to aggregate entire sub-trees with standard filtering.

## Practical database implementation

The following schema demonstrates one-to-one, one-to-many, an OLTP junction table, and an analytical dimensional bridge table with weighting factors:

```sql
-- 1. BASE ENTITY: Students
CREATE TABLE students (
    student_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name    VARCHAR(100) NOT NULL,
    email        VARCHAR(255) NOT NULL UNIQUE
);

-- 2. ONE-TO-ONE (1:1): StudentProfiles (Shared PK/FK with UNIQUE constraint)
CREATE TABLE student_profiles (
    student_id        INTEGER PRIMARY KEY,
    emergency_contact VARCHAR(100) NOT NULL,
    medical_notes     TEXT,
    CONSTRAINT fk_profile_student
        FOREIGN KEY (student_id)
        REFERENCES students (student_id)
        ON DELETE CASCADE
);

-- 3. ONE-TO-MANY (1:N): Departments to Courses
CREATE TABLE departments (
    department_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_title  VARCHAR(100) NOT NULL,
    credits       INTEGER NOT NULL CHECK (credits > 0),
    department_id INTEGER NOT NULL, -- Foreign key establishes 1:N
    CONSTRAINT fk_courses_dept
        FOREIGN KEY (department_id)
        REFERENCES departments (department_id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_courses_department_id ON courses(department_id);

-- 4. MANY-TO-MANY (M:N) JUNCTION TABLE: StudentCourseEnrollments
CREATE TABLE student_course_enrollments (
    student_id      INTEGER NOT NULL,
    course_id       INTEGER NOT NULL,
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    grade           VARCHAR(2),
    PRIMARY KEY (student_id, course_id),
    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id)
        REFERENCES students (student_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_enrollment_course
        FOREIGN KEY (course_id)
        REFERENCES courses (course_id)
        ON DELETE CASCADE
);

-- Index reverse searches on the junction table
CREATE INDEX idx_enrollments_course_id ON student_course_enrollments(course_id);

-- 5. DIMENSIONAL BRIDGE TABLE: Multi-valued diagnoses with weighting factors
CREATE TABLE dim_diagnoses (
    diagnosis_key   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    icd_code        VARCHAR(20) NOT NULL UNIQUE,
    description     VARCHAR(255) NOT NULL
);

-- Bridge table connecting diagnosis groups to individual diagnoses
CREATE TABLE bridge_diagnosis_group (
    diagnosis_group_id INTEGER NOT NULL,
    diagnosis_key      INTEGER NOT NULL,
    weighting_factor   NUMERIC(3, 2) NOT NULL CHECK (weighting_factor > 0.00 AND weighting_factor <= 1.00),
    PRIMARY KEY (diagnosis_group_id, diagnosis_key),
    CONSTRAINT fk_bridge_diagnosis
        FOREIGN KEY (diagnosis_key)
        REFERENCES dim_diagnoses (diagnosis_key)
);

CREATE INDEX idx_bridge_diagnosis_key ON bridge_diagnosis_group(diagnosis_key);

-- Fact table referencing diagnosis_group_id
CREATE TABLE fact_billing (
    billing_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id         INTEGER NOT NULL,
    diagnosis_group_id INTEGER NOT NULL, -- References the multi-valued bridge group
    billed_amount      NUMERIC(10, 2) NOT NULL CHECK (billed_amount >= 0.00)
);

CREATE INDEX idx_fact_billing_group_id ON fact_billing(diagnosis_group_id);
```

### Analytical reporting query

The following SQL statement demonstrates how weighting factors prevent double-counting while supporting total impact analysis:

```sql
SELECT 
    d.description AS diagnosis_description,
    -- Correctly weighted revenue: prevents double-counting across multi-valued diagnoses
    SUM(f.billed_amount * b.weighting_factor) AS weighted_revenue,
    -- Full impact revenue: shows total transaction volume touched by each diagnosis
    SUM(f.billed_amount)                      AS total_impact_volume
FROM fact_billing f
JOIN bridge_diagnosis_group b ON f.diagnosis_group_id = b.diagnosis_group_id
JOIN dim_diagnoses d         ON b.diagnosis_key = d.diagnosis_key
GROUP BY d.description
ORDER BY weighted_revenue DESC;
```

## Common design pitfalls

### Row explosion in many-to-many joins

Joining two tables on non-unique keys or joining through unconstrained many-to-many associations produces a Cartesian cross-product of matching rows.

For example, if 5 records on the left table match 10 records on the right table with duplicate keys, the database generates 50 output rows. In large enterprise workloads, unconstrained many-to-many joins exhaust database working memory and disk temporary space, causing query failure.

### Inflated metric calculations across bridge tables

Joining an analytical fact table to a multi-valued dimension through a bridge table replicates fact records for each associated dimension member.

Running a basic `SUM(billed_amount)` without incorporating `weighting_factor` counts each invoice multiple times. When designing bridge tables, analysts must either multiply additive facts by the weighting factor or aggregate metrics in an isolated Common Table Expression (CTE) query before joining the bridge table.

### The fan trap and chasm trap

The fan trap and chasm trap represent classic join path anomalies in database modeling:

- **The fan trap**: occurs when a query joins two "Many" child tables along a single relational path where the master table joins to child A, which then joins to child B. Aggregating across the path produces inflated sums because rows in child A multiply against matching rows in child B.
- **The chasm trap**: occurs when a query joins two independent "Many" child tables through a shared "One" parent dimension. For example, querying `customer_orders` and `customer_payments` simultaneously through `dim_customer`. The relational engine produces a Cartesian product between orders and payments for each customer, corrupting numeric aggregations.

#### Resolving the chasm trap with multi-pass queries

To resolve the chasm trap, execute multi-pass SQL. Aggregate each child relationship independently inside separate Common Table Expression (CTE) queries, and merge the summarized results using a `FULL OUTER JOIN` on the common dimension key:

```sql
WITH order_summary AS (
    SELECT 
        customer_id,
        COUNT(order_id)         AS total_orders,
        SUM(total_order_amount) AS total_order_spend
    FROM orders
    GROUP BY customer_id
),
payment_summary AS (
    SELECT 
        customer_id,
        COUNT(payment_id)   AS total_payments,
        SUM(payment_amount) AS total_paid
    FROM payments
    GROUP BY customer_id
)
SELECT 
    COALESCE(o.customer_id, p.customer_id) AS customer_id,
    COALESCE(o.total_orders, 0)            AS total_orders,
    COALESCE(o.total_order_spend, 0.00)    AS total_order_spend,
    COALESCE(p.total_payments, 0)          AS total_payments,
    COALESCE(p.total_paid, 0.00)           AS total_paid
FROM order_summary o
FULL OUTER JOIN payment_summary p ON o.customer_id = p.customer_id;
```

### Missing indexes on junction table foreign keys

A composite primary key on a junction table, such as `PRIMARY KEY (student_id, course_id)`, automatically creates an index on the leading column `(student_id)`.

However, queries that filter or join by the second column, such as finding all students enrolled in a specific course, can't utilize the leading index prefix. Without a dedicated secondary index on `(course_id)`, reverse searches trigger expensive full table scans across the entire junction table.

### Relational shredding versus document store data locality

Normalizing every one-to-many association into dedicated child tables shreds cohesive business documents into multiple physical tables. Reconstructing a complex domain object requires multi-way joins that increase query latency.

For strictly hierarchical, self-contained objects, such as a user profile containing school degrees and work history, document databases store nested structures in a single record with high data locality. However, when domain requirements evolve to require true many-to-many associations across records, document databases require manual app joins or uncontrolled duplication. Relational schemas with explicit junction tables remain far more resilient to structural domain shifts.

## Key takeaways

- Use 1:1 split tables with shared primary keys to separate security-sensitive or optional columns.
- Place foreign keys in the child table to implement 1:N relationships.
- Decompose many-to-many relationships into two 1:N associations using associative junction tables.
- Declare composite primary keys on junction tables to prevent duplicate relationship pairings.
- Create explicit secondary indexes on the second column of junction tables to support efficient reverse searches.
- Implement dimensional bridge tables with weighting factors to prevent double-counting across multi-valued dimensions.
- Use multi-pass CTE queries to prevent Cartesian row multiplication in fan traps and chasm traps.
