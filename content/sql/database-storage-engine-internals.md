# Database storage engine internals

## Overview

A database storage engine manages how a relational database stores data on
disk, caches frequently used pages in memory, records changes, and recovers
after a failure.

This guide explains the main components of a page-oriented storage engine:

- Pages and heap files
- Slotted pages
- Buffer pools
- Write-ahead logging
- Checkpoints and crash recovery

The exact page size, cache policy, logging format, and recovery algorithm vary
by database engine. The concepts in this guide apply broadly, but you should
check your engine's documentation for implementation details.

## Storage engine architecture

The storage engine moves pages between durable storage and memory. It records
changes in the write-ahead log before it writes modified data pages back to the heap file.

```mermaid
---
title: Storage engine architecture
---
graph TD
    Client[Application / SQL Client]:::external

    subgraph RAM ["VOLATILE MEMORY (RAM)"]
        direction TB

        subgraph EngineMemory ["Database Process Space"]
            ExecutionEngine[Query execution engine]:::process

            subgraph BufferPool ["Buffer Pool Cache"]
                Page1["Page 1 (Clean)"]
                Page2["Page 2 (Dirty / Modified)"]
                Page3["Page 3 (Clean)"]
            end

            WALBuffer["WAL log buffer"]:::memory
        end
    end

    subgraph OS ["OPERATING SYSTEM / KERNEL"]
        OSIO["OS kernel and I/O subsystem"]:::process
    end

    subgraph Disk ["PERSISTENT STORAGE (DISK)"]
        direction TB

        subgraph HeapFiles ["Heap Data Files"]
            DiskPage1["Page 1 Block (8 KB)"]:::storage
            DiskPage2["Page 2 Block (8 KB)"]:::storage
            DiskPage3["Page 3 Block (8 KB)"]:::storage
        end

        WALFile["Write-ahead log file"]:::storage
    end

    %% Queries and Execution
    Client -->|1. SQL Query| ExecutionEngine

    %% Read Path
    ExecutionEngine -->|2. Check Cache| BufferPool
    BufferPool -.->|3a. Buffer Hit: Fast Read| ExecutionEngine
    BufferPool -->|3b. Buffer Miss: Request Page| OSIO
    OSIO -->|4. Read 8 KB Page| HeapFiles
    HeapFiles -.->|5. Load Page into RAM| BufferPool

    %% Write Path (Fast Path)
    ExecutionEngine -->|6. Modify Page in RAM| Page2
    ExecutionEngine -->|7. Append Log Record| WALBuffer
    WALBuffer -->|8. Flush Log Entry| OSIO
    OSIO -->|9. Sequential Append| WALFile
    WALFile -.->|10. Ack Durability| Client

    %% Background Flush Path (Slow Path)
    Page2 -.->|11. Async Checkpoint / Flush| OSIO
    OSIO -.->|12. Overwrite Page Block| DiskPage2

    class RAM memory;
    class Disk storage;
```

The diagram shows the logical relationships. A production engine can use
additional components, such as lock managers, transaction managers, indexes,
replication logs, and background writers.

## Pages and heap files

### Page-oriented storage

Database engines generally read and write fixed-size blocks called pages
rather than individual rows. Common page sizes include 4 KiB, 8 KiB, and
16 KiB, but the supported sizes depend on the database engine.

Each page has an address within a database file. Disk I/O operates on the
page, even when a query needs only one row from that page.

Page-oriented storage provides a consistent unit for:

- Reading and writing data.
- Tracking free space.
- Caching data in memory.
- Recording page-level changes.

### Heap files

A heap file is an unordered collection of data pages. The storage engine
places a new row on a page with enough free space instead of maintaining a
sorted order.

```mermaid
---
title: Heap file architecture
---
flowchart TD
    %% Write path (Insert)
    InsertOp["INSERT Request<br/>(Requires 2 KB space)"]

    subgraph HeapFile ["Heap File on Disk"]
        direction TB

        subgraph Directory ["Page Directory / Free-Space Map"]
            direction LR
            Dir1["Directory Entry 1<br/>Page 1 | Free: 0 KB (Full)"]
            Dir2["Directory Entry 2<br/>Page 2 | Free: 4 KB (Available)"]
            Dir3["Directory Entry 3<br/>Page 3 | Free: 8 KB (Empty)"]
        end

        subgraph DataPages ["Unordered Data Pages (Fixed 8 KB Pages)"]
            direction LR

            subgraph Page1 ["Page 1 (Full)"]
                direction TB
                P1_H["Page Header (ID: 1)"]
                P1_S0["Slot 0: Record A"]
                P1_S1["Slot 1: Record B"]
            end

            subgraph Page2 ["Page 2 (Has Space)"]
                direction TB
                P2_H["Page Header (ID: 2)"]
                P2_S0["Slot 0: Record C"]
                P2_Free["[ 4 KB Free Space ]"]
            end

            subgraph Page3 ["Page 3 (Empty)"]
                direction TB
                P3_H["Page Header (ID: 3)"]
                P3_Free["[ 8 KB Free Space ]"]
            end
        end
    end

    %% Read path (Index Lookup via Row ID)
    IndexLookup["Secondary Index Entry<br/>Row ID: (Page 2, Slot 0)"]

    %% Directory tracking (file offsets to page headers)
    Dir1 -->|"File Offset"| P1_H
    Dir2 -->|"File Offset"| P2_H
    Dir3 -->|"File Offset"| P3_H

    %% Write path: check directory for space, then append
    InsertOp -->|"1. Consult directory for free space"| Dir2
    Dir2 -.->|"2. Place into free space"| P2_Free

    %% Read path: direct pointer lookup to target slot
    IndexLookup ==>|"Direct pointer lookup"| P2_S0
```

The engine maintains a free-space map or page directory to find pages that
can hold new rows.

A row in a heap file has a physical identifier, often called a row ID.
It commonly contains a page identifier and a slot number:

```text
(Page ID, Slot number)
```

Secondary indexes can store this identifier as a pointer to the row's
location in the heap.

## Slotted pages

Fixed-size pages must store variable-length rows such as `VARCHAR`, `TEXT`,
and columns that can be null. A slotted page uses an array of row pointers so that
the row data can move within the page without changing the row's logical slot.

```mermaid
---
title: Slotted page architecture
---
flowchart TD
    %% External caller / index
    subgraph Lookup ["Logical Row ID Lookup"]
        RowID["Secondary Index Entry<br/>Row ID: (Page 2, Slot 1)<br/><i>Stable logical reference</i>"]
    end

    %% Slotted Page Container
    subgraph Page ["Slotted Page: Page 2 (Fixed 8 KB Block)"]
        direction TB

        subgraph Header ["1. Page Header (Byte 0)"]
            H["Metadata: Page ID = 2 | LSN = 1042 | Slot Count = 2<br/>Free Space Bounds: Lower = Byte 72 | Upper = Byte 7880"]
        end

        subgraph Slots ["2. Slot Array / Directory (Grows Downward ↓)"]
            direction LR
            Slot0["Slot 0<br/>Offset: 8000 | Len: 120B"]
            Slot1["Slot 1<br/>Offset: 7880 | Len: 90B"]
        end

        subgraph FreeSpace ["3. Contiguous Free-Space Gap"]
            Gap["[ Unallocated Free Space: Bytes 72 to 7879 ]<br/>New slots allocate downward ↓ | New records allocate upward ↑<br/><i>(Page is full when Lower Pointer meets Upper Pointer)</i>"]
        end

        subgraph Payloads ["4. Record Payloads (Grows Upward from End of Page ↑)"]
            direction LR
            Rec0["Record 0 Payload<br/>Bytes 8000..8119 (120B)"]
            Rec1["Record 1 Payload<br/>Bytes 7880..7969 (90B)"]
        end
    end

    %% Indirection Lookup Flow
    RowID ==>|"Step 1: Locate stable slot entry"| Slot1
    Slot1 ==>|"Step 2: Follow byte offset to payload"| Rec1

    %% Secondary slot mapping
    Slot0 -.->|"Offset: 8000"| Rec0
```

A slotted page contains:

1. **Page header:** metadata such as the page identifier, log sequence number,
   slot count, and free-space boundaries.
2. **Slot array:** pointers that store each record's offset and length.
3. **Free-space gap:** space between the slot array and record payloads.
4. **Record payloads:** the variable-length row data.

When the engine compacts a page or moves a variable-length row, it updates the
slot's offset. The slot number can remain stable, so indexes that reference
the row identifier continue to locate the row.

## Buffer pools

A buffer pool, also called a buffer cache, stores copies of database pages in
RAM. Reading a page from memory is generally faster than reading it from
storage, so the buffer pool reduces repeated storage access for frequently
used pages.

The buffer pool contains:

- **Frames:** fixed-size memory regions that hold database pages.
- **Page table:** an in-memory mapping from a page ID to a frame.
- **Dirty bit:** indicates that the memory copy differs from the durable copy.
- **Pin count:** prevents the engine from evicting a page while a query uses it.
- **Eviction policy:** selects an unpinned page when the pool needs space.

Common eviction strategies include least recently used and Clock
variants. The selected policy and its tuning options depend on the database
engine.

### Buffer-pool lifecycle

When a query requests a page, the buffer manager:

1. Checks the page table.
2. Returns the page from an existing frame if it's present.
3. Reads the page from the heap file when the lookup misses.
4. Selects an unpinned victim frame if the buffer pool is full.
5. Writes a dirty victim page to durable storage only when the write-ahead log rule allows
   it.

## Write-ahead logging

Write-ahead logging records changes in an append-only log before the engine
writes the modified data page to the heap file.

### Write-ahead logging rule

The storage engine follows this ordering:

1. Create a log record for the change.
2. Flush the required write-ahead log records to durable storage.
3. Modify the page in the buffer pool.
4. Flush the dirty page later, after the log record is durable.

This ordering lets the engine acknowledge a committed transaction after the
log is durable, without forcing every changed data page to receive a random
storage write at commit time.

### Log sequence numbers

Each write-ahead log record commonly has a log sequence number. The page header
can store the log sequence number of the newest log record applied to that page. During
recovery, the engine compares page log sequence numbers with log sequence
numbers in the write-ahead log to determine which changes it must
replay.

The exact write-ahead log format and durability properties depend on the database engine
and its configuration.

## Crash recovery

If the process or host fails, the failure can discard changes that existed only in RAM.
The engine uses the write-ahead log and checkpoint metadata to restore a consistent state.

Many engines describe recovery as two broad activities:

- **Redo:** reapply logged changes that the data pages might not contain.
- **Undo:** remove changes from transactions that had not committed.

The recovery algorithm, terminology, and ordering can vary. Some engines also
use full-page images, checksums, double-write buffers, or other mechanisms to
protect against partial page writes.

## Update execution

Consider this statement:

```sql
UPDATE Employees
SET Salary = 95000
WHERE EmployeeID = 101;
```

The storage path is conceptually:

```mermaid
---
title: Update execution flow
---
flowchart TD
    Req["UPDATE Request<br/>(EmployeeID = 101, Salary = 95000)"]
    Req --> Step1["1. Locate page for Employee 101"]
    Step1 --> Check{"Page in buffer pool?"}

    Check -- "Yes (Cache hit)" --> Pin["Pin buffer frame"]
    Check -- "No (Cache miss)" --> ReadDisk["2. Read page from heap file into frame"]
    ReadDisk --> Pin

    subgraph FastPath ["Fast Durability Path (Write-Ahead Logging)"]
        direction TB
        Pin --> Step3["3. Append log record to WAL buffer"]
        Step3 --> Step4["4. Flush WAL log to durable storage"]
        Step4 --> Step5["5. Update row in memory & mark frame dirty (set page LSN)"]
        Step5 --> Step6["6. Acknowledge commit to client"]
    end

    subgraph AsyncPath ["Asynchronous Background Persistence"]
        direction TB
        Step6 -.->|"Deferred background write"| Step7["7. Checkpoint / Background writer writes dirty page to heap file"]
    end
```

The steps are:

1. The query executor asks the buffer manager for the page containing
   `EmployeeID = 101`.
2. On a buffer miss, the buffer manager reads the page from the heap file into
   an available frame.
3. The engine appends a write-ahead log record describing the update.
4. The engine flushes the required log data to durable storage.
5. The engine updates the row in the memory page, records the page log sequence number, and
   marks the frame dirty.
6. The transaction can acknowledge a durable commit according to the engine's
   configured durability settings.
7. A background writer or checkpoint process later writes the dirty page to
   the heap file.

## Common pitfalls

### Buffer-pool thrashing

Buffer-pool thrashing occurs when the active working set is much larger than
the available buffer pool. The engine repeatedly evicts and reloads pages,
which increases storage I/O and query latency.

Monitor cache hit rates, storage latency, query plans, and working-set size.
Reduce unnecessary scans and size the buffer pool according to the workload
and available memory.

### Write amplification and page splits

A small row update can eventually require the engine to write the entire page.
An update that expands a variable-length row can also leave insufficient free
space on the page.

Depending on the storage engine, the row might move, the page might split, or
the engine might create an overflow or forwarding reference. These operations
can increase storage writes and later read work.

### Checkpoint frequency and recovery time

Frequent checkpoints can add background write activity. Infrequent checkpoints
can leave more work in the write-ahead log, which can lengthen redo after a failure.

Choose checkpoint settings by measuring normal write load, recovery targets,
storage throughput, and available write-ahead log capacity.

### Torn pages

A torn page is a page that reaches storage only partially before a power loss
or hardware failure. The durable copy can contain portions from different
versions of the page.

Engines can protect against torn pages with mechanisms such as double-write
buffers, page checksums, or full-page images in the write-ahead log. Verify which
mechanisms your database engine and storage configuration provide.

## Key takeaways

- Database engines read and write pages rather than individual rows.
- Heap files store unordered pages, while slotted pages track movable row
  payloads with stable slots.
- Buffer pools cache pages and use dirty bits, pin counts, and eviction
  policies to manage memory.
- Write-ahead logging records changes before the engine flushes modified data pages.
- Crash recovery uses logged changes to redo durable work and undo incomplete
  transactions.
- Checkpoint and cache settings affect both normal performance and recovery
  time.
