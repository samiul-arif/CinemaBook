# CinemaSeat Technical & Architectural Decisions

This document details three critical architectural and design decisions our team debated during the hackathon, outlining the options considered, our final choices, justifications, and trade-offs.

---

## Decision 1: PostgreSQL Single-Statement Compare-and-Set vs. Redis Distributed Locks for Seat Holds

### Context & Problem
Under high-concurrency ticket drops (e.g. 100 users attempting to claim seat F12 at 8:00:00 PM), the system must guarantee **zero overselling** without introducing unnecessary latency or race condition windows.

### Options Considered
1. **Option A: Redis Redlock / Distributed Lock**
   - Acquire a Redis lock for seat ID before checking Postgres availability and writing the hold.
   - *Drawback*: Requires maintaining lock TTLs, handling Redis failover/down scenarios, and introduces dual-phase commits across two data stores (Redis + Postgres). If Redis crashes or drops connection, seats could fail to unlock.
2. **Option B: PostgreSQL Single-Statement Atomic `UPDATE` (Chosen)**
   - Issue a single SQL statement:
     ```sql
     UPDATE seats
     SET status = 'HELD', hold_expires_at = $1, held_by_booking_ref = $2
     WHERE id = $3 AND showtime_id = $4
       AND (status = 'AVAILABLE' OR (status = 'HELD' AND hold_expires_at < now()))
     RETURNING *;
     ```
   - *Advantage*: Postgres natively acquires an exclusive row-level lock during the statement execution. Out of 100 parallel requests, exactly 1 statement updates 1 row; 99 statements match 0 rows and cleanly return HTTP 409 Conflict.

### What We Gave Up
By choosing Postgres row locks over Redis distributed locks, DB CPU load during peak spikes is slightly higher than an in-memory lock check. However, we eliminated all cross-system inconsistency bugs and guaranteed 100% ACID correctness.

---

## Decision 2: Monolithic Modular Express App vs. Microservices Architecture

### Context & Problem
The system needs to handle high request volumes and fault isolation without overcomplicating deployment or inter-service communication under hackathon time constraints.

### Options Considered
1. **Option A: Microservices (Split Booking, Payment, Movie Catalog into separate containers)**
   - *Drawback*: Requires network RPCs/HTTP calls between services, distributed tracing, shared database management, and complex Docker Compose orchestration. Network failures between microservices can cause partial state corruption.
2. **Option B: Modular Express Monolith (Chosen)**
   - Single Express application with clean internal service boundaries (`seatService`, `bookingService`, `paymentService`, `otpService`).
   - *Advantage*: Zero network overhead for internal transactions, atomic multi-table database transactions (`withTransaction`), simple Docker Compose setup (`docker compose up`), and easier debugging under load.

### What We Gave Up
Independent autoscaling of individual modules (e.g. scaling payment independently of movie catalog). However, since database row contention is the primary bottleneck rather than Node.js CPU, a modular monolith provided superior performance and simplicity.

---

## Decision 3: Database Event Log Table (`payment_events`) vs. In-Memory Cache for Webhook Idempotency

### Context & Problem
The mock payment gateway emits duplicate callbacks (approx 8% of the time) and delayed callbacks (2-15s). Webhook handlers MUST be idempotent and return HTTP 200 without double-booking seats or double-counting revenue.

### Options Considered
1. **Option A: In-Memory / Redis Flag (`SETNX event_id`)**
   - *Drawback*: In-memory cache is volatile. If the container restarts or Redis clears keys, duplicate callbacks arriving later would re-execute business logic.
2. **Option B: Persistent PostgreSQL `payment_events` Table (Chosen)**
   - Store every incoming webhook payload in a dedicated `payment_events` table with `event_id` as the PRIMARY KEY.
   - Execute callback handling inside a Postgres transaction:
     ```sql
     INSERT INTO payment_events (event_id, payment_id, status, amount, raw_payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id) DO NOTHING;
     ```
   - If `rowCount === 0`, return `{ received: true, duplicate: true }` with HTTP 200 immediately.

### What We Gave Up
A minor disk write on each webhook call. In return, we gained durable, audit-proof idempotency that survives application crashes, container restarts, and database reconnections.
