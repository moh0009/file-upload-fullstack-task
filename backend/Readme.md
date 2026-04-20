# Backend — Setup & Developer Guide

The Go backend serves the REST API, handles chunked file uploads, streams progress over WebSocket, and processes CSV data into PostgreSQL using a Redis-backed priority queue and worker pool.

---

## Research Decision Record

> "I chose Redis pub-sub over in-memory Go channels for progress broadcasting because the architecture must support horizontal scaling — multiple Go instances can share a single Redis broker, so any worker process can publish progress and the WebSocket handler on any instance will relay it to the correct browser client. An in-memory channel would break as soon as a second backend pod was deployed."

> "I chose `pgx/v5` with `CopyFrom` over `database/sql` + bulk `INSERT` because `COPY FROM STDIN` bypasses the SQL planner, yields roughly 10× higher throughput for large CSV imports, and streams data row-by-row without buffering the entire file in memory."

> "I chose a CTE-based batch upsert (`validated → deleted → inserted`) over a simple INSERT because it atomically validates, removes from staging, and writes to the main table in a single round-trip, preventing partial writes on crash and eliminating the need for a separate cleanup job."

---

## Prerequisites

| Tool | Version |
|------|---------|
| Go | 1.21+ |
| Docker + Docker Compose | Any recent version |
| PostgreSQL | 15 (via Docker) |
| Redis | 7 (via Docker) |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `students_db` | Database name |
| `REDIS_ADDR` | `localhost:6379` | Redis address |
| `SERVER_PORT` | `8080` | HTTP listen port |
| `UPLOADS_DIR` | `./uploads` | Temp storage for uploaded chunks |
| `MAX_FILE_SIZE` | `2147483648` | Max per-chunk size in bytes (2 GB) |
| `WORKER_COUNT` | `4` | Parallel CSV processing workers |
| `QUEUE_MAX_RETRIES` | `3` | Max job retry attempts on failure |

Copy `.env.example` (if provided) or export the variables manually.

---

## Quick Start

### Option 1 — Docker Compose (recommended)

```bash
cd backend
docker compose up -d        # starts PostgreSQL + Redis
go run .                    # starts the API server on :8080
```

### Option 2 — Manual

```bash
# 1. Start PostgreSQL and Redis externally, then:
export DB_HOST=localhost DB_USER=postgres DB_PASSWORD=postgres DB_NAME=students_db
export REDIS_ADDR=localhost:6379

# 2. Start the server (Schema is automatically initialized)
cd backend
go run .
```

---

## Architecture Overview

```
main.go
  ├── config.Load()          — reads env vars
  ├── config.InitDatabase()  — opens pgxpool, runs schema migrations
  ├── config.InitRedis()     — opens redis.Client
  ├── handlers.NewHandler()  — wires all dependencies
  │     ├── progress.NewProgressHub(rdb)   — Redis pub-sub broadcaster
  │     ├── queue.NewRedisQueue(rdb, ...)  — priority job queue
  │     └── worker.NewWorkerManager(...)   — goroutine pool
  └── gin router
        ├── POST /api/upload          → handlers.UploadFiles
        ├── POST /api/process         → handlers.ProcessPost
        ├── GET  /api/ws/progress     → handlers.HandleProgressWS
        └── /api/students/...         → handlers.GetStudents / etc.
```

### Key Packages

| Package | Responsibility |
|---------|---------------|
| `config` | Load env, init DB pool + Redis, auto-migrate schema |
| `handlers` | HTTP handler functions — input validation, error responses |
| `errors` | Typed `AppError` struct + `Respond()` helper for consistent JSON errors |
| `progress` | `RedisProgressHub` — publish/subscribe progress payloads via Redis |
| `queue` | `RedisQueue` — sorted-set priority queue backed by Redis |
| `worker` | `WorkerManager` — goroutine pool that dequeues and processes jobs |

---

## Database & Redis Structure
The Postgres schema uses two tables and is created automatically on startup:

`students_staging`: Used for intermediate fast copy from CSV.
- `id`: SERIAL PRIMARY KEY
- `name`: TEXT
- `subject`: TEXT
- `grade`: TEXT (handled as text to accommodate unparsed row data during CSV load)

`students`: Final validated table for the web application.
- `id`: SERIAL PRIMARY KEY
- `name`: TEXT
- `subject`: TEXT
- `grade`: INTEGER

**Redis Usage**:
- `csv:queue:priority`: Sorted sets (ZSET) holding jobs ordered by insertion time.
- `csv:jobs`: Hashes (HSET) tracking job JSON metadata.
- `csv:workers`: Hashes (HSET) tracking heartbeat timestamps of workers.
- **Pub/Sub**: `progress:jobs:*` channels push realtime JSON updates for websockets.

---

## Running Tests

```bash
cd backend
go test ./...
```

---

## Building a Production Binary

```bash
cd backend
go build -o server .
./server
```
