# PACE Platform

A full-stack web application that ingests large CSV files containing student grade data, displays real-time upload and processing progress, and exposes a rich data table with filtering, sorting, and pagination.

---

## Screenshots

### Uploading a file and Processing it

![alt text](readme_media/one.png)
![alt text](readme_media/three.png)

### Students table

![alt text](readme_media/four.png)

## Video Demo

<video width="1080" height="720" controls>
  <source src="./readme_media/video_demo.mp4" type="video/mp4">
</video>

## Features

| Feature                | Detail                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Multi-file upload      | Drag-and-drop or browse; multiple files processed concurrently            |
| Chunked transfer       | 5 MB chunks with XHR progress for accurate per-file upload bar            |
| Real-time progress     | WebSocket stream pushes upload % and processing % to the UI               |
| Parallel CSV ingestion | Go `errgroup` + PostgreSQL `COPY FROM STDIN` + CTE batch upsert           |
| Student data table     | Server-side keyset pagination, sort (name / grade / id), multi-filter     |
| Accessibility          | WCAG 2.1 AA — ARIA roles, keyboard navigation, screen-reader live regions |
| Resilient WebSockets   | Exponential back-off reconnection (up to 5 retries, max 30 s delay)       |

---

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Backend          | Go 1.21, Gin, pgx v5, go-redis v9                  |
| Queue / Pub-Sub  | Redis                                              |
| Database         | PostgreSQL 15                                      |
| Frontend         | Next.js 15 (App Router), React 19, Tailwind CSS v4 |
| Containerisation | Docker Compose                                     |

---

## Quick Start

### With Docker Compose

you can run the whole app using docker compose :

```bash
# 1. Clone the repository
git clone https://github.com/moh0009/PACE-platform.git
cd PACE-paltfrom

# 2. Start the docker compose
docker compose up -d
```

### Locally

```bash
# 1. Clone the repository
git clone https://github.com/moh0009/PACE-platform.git
cd PACE-paltfrom
```

if you don't have redis, or postgres installed locally you can use docker compose to start them

```bash
# 2. Start PostgreSQL + Redis
cd backend
docker compose up -d
```

make sure you create `.env` in `/backend` as showed [here](#configuration--environment)

then start the backend and frontend

```bash
# 3. Start the Go backend (separate terminal)
go run .

# 4. Start the Next.js frontend (separate terminal)
cd ../frontend/pace-front_end
npm install
npm run dev
```

then open **http://localhost:3000** in your browser.

> See [`backend/Readme.md`](backend/Readme.md) and [`frontend/Readme.md`](frontend/Readme.md) for full setup instructions, environment variables, and manual run steps.

---

## Performance Metrics

The following metrics describe the time required to upload and process file data with 4 workers:

| Operation                       | Rate                   |
| ------------------------------- | ---------------------- |
| File uploading                  | **0.5 seconds per MB** |
| File processing (CSV ingestion) | **75 seconds per MB**  |

**Example:**

- A 10 MB file would take ~5 seconds to upload and ~750 seconds (~12.5 minutes) to process.
- Multiple files are processed concurrently via the worker pool, so total processing time depends on `WORKER_COUNT`.

---

## Configuration & Environment

### Backend

Create a `.env` file in `backend/` with the following variables. See [`backend/Readme.md`](backend/Readme.md) for detailed descriptions of each variable.

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=students_db

# Redis Configuration
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=

# Server Configuration
SERVER_PORT=8080

# File Upload Configuration
UPLOADS_DIR=./uploads
MAX_FILE_SIZE=2147483648

# Processing Configuration
WORKER_COUNT=4
QUEUE_MAX_RETRIES=3
```

### Frontend

Create a `.env.local` file in `frontend/pace-front_end/` (optional, as it has a default value):

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### Frontend

Create `frontend/pace-front_end/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

## Production Deployment

### CORS Checklist

Before deploying, update the CORS config in `backend/main.go` and the WebSocket origin check in `backend/handlers/websocket.go` with your production domain.

### Horizontal Scaling

The backend is stateless. You can run multiple instances behind a load balancer. They must share the same Redis and PostgreSQL instances. No sticky sessions are required.

### Production Build

**Backend:**

```bash
cd backend
CGO_ENABLED=0 GOOS=linux go build -o server .
./server
```

**Frontend:**

```bash
cd frontend/pace-front_end
npm run build
npm run start
```

---

## Workflow

```
User drops CSV(s)
      │
      ▼
UploadSection (Next.js)
  └─ Chunks file into 5 MB parts
  └─ POSTs each chunk to  POST /api/upload
  └─ Opens WebSocket       GET  /api/ws/progress?fileId=…
      │
      ▼
Go backend — UploadFiles handler
  └─ Saves chunk to disk
  └─ Publishes upload % to Redis pub-sub
  └─ Merges chunks when last part arrives
      │
      ▼
Frontend — POST /api/process  →  ProcessPost handler
  └─ Enqueues job to Redis priority queue
      │
      ▼
Go WorkerManager (background goroutine pool)
  └─ ProcessFileWithRedis:
       1. COPY CSV → students_staging  (streaming, tracks bytes read)
       2. CTE batch upsert → students  (parallel, 10 k rows / batch)
       3. Publishes process % to Redis pub-sub
      │
      ▼
ProgressHub  (Redis Pub-Sub → WebSocket)
  └─ Pushes { stage, upload_pct, process_pct } to browser
      │
      ▼
StudentsTable (Next.js)
  └─ Keyset pagination, sort, filter against GET /api/students
```

---

## Time Reporting

Each file card shows:

- **Upload time** — wall-clock time from first chunk POST to merge complete.
- **Processing time** — wall-clock time from job dequeue to final CTE commit.
- **Total time** — sum of both phases (or estimated duration while in-progress).

---

## API Reference

See [`API.md`](API.md) for the full endpoint reference including request/response schemas and WebSocket message format.
