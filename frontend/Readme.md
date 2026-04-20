# Frontend — Setup & Developer Guide

The frontend is a Next.js 15 (App Router) application that provides the PACE Platform dashboard: a drag-and-drop file upload section with real-time progress, and a filterable, sortable, paginated student data table.

---

## Research Decision Record

> "I chose Next.js (App Router) over Create React App / Vite because the project benefits from React Server Components for the shell layout, built-in image optimisation, and the mature production readiness of Next.js — without needing to configure a separate bundler. The App Router also enables future server-side data fetching for the students table with zero client-side waterfall."

> "I chose react-dropzone over a plain `<input type=file>` because it handles drag-and-drop across all major browsers, provides accessible keyboard events, and integrates cleanly with our custom UI without importing a full component library."

> "I chose ManagedWebSocket (custom class) over a third-party reconnect library because our requirements are simple (exponential back-off, destroy-on-complete), and avoiding an extra dependency keeps the bundle smaller and the behaviour fully transparent."

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/api` | Base URL of the Go backend API |

Create a `.env.local` file in `frontend/pace-front_end/` if you need to override the default:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

> **Note**: `lib/utils.js` currently hard-codes `http://localhost:8080/api`. If you add the env variable, update that file to read `process.env.NEXT_PUBLIC_API_URL`.

---

## Quick Start

```bash
cd frontend/pace-front_end
npm install
npm run dev       # starts on http://localhost:3000
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Serve the production build |
| `npm run analyze` | Build + open interactive bundle analyser in browser |

---

## Component Map

```
src/app/
  ├── layout.jsx           — Root layout: NotificationProvider, FileProvider, Sidebar
  ├── page.jsx             — Home: renders UploadSection
  └── students/page.jsx    — Students: renders StudentsTable

components/
  ├── UploadSection.jsx    — Drag-and-drop, chunked upload, WebSocket progress
  ├── File.jsx             — Per-file progress card (upload + processing bars)
  ├── StudentsTable.jsx    — Paginated table with sort & filter controls
  ├── Sidebar.jsx          — Navigation sidebar
  ├── Dropdown.jsx         — react-select wrapper
  ├── MinimalDropdown.jsx  — Row-level actions (edit / delete)
  ├── StudentModal.jsx     — Edit student modal
  ├── GradeSlider.jsx      — Dual-handle grade range slider
  └── DuplicateFileDialog.jsx — Modal for duplicate file confirmation

lib/
  ├── utils.js             — fetchAPI, uploadChunk, connectWS, error helpers
  └── websocket.js         — ManagedWebSocket (exponential back-off reconnection)

context/
  ├── FileContext.jsx      — Global file list state (persisted to localStorage)
  └── NotificationContext.jsx — Toast notification system
```

---

## Key Design Decisions

### Chunked Upload
Files are split into 5 MB chunks and uploaded sequentially via `XMLHttpRequest`. This allows accurate per-chunk progress reporting and avoids HTTP request body size limits on the server.

### WebSocket Reconnection
`ManagedWebSocket` (`lib/websocket.js`) wraps the native `WebSocket` with:
- Exponential back-off: `delay = min(baseDelay × 2^attempt, 30_000)` ms + up to 500 ms jitter.
- Maximum 5 retry attempts before marking the file as errored.
- Automatic cleanup via `destroy()` when the file reaches `Complete` or `Error` state.

### State Persistence
`FileContext` serialises the file list to `localStorage` (excluding the `File` blob, which cannot be serialised). On reload, files in `Uploading` / `Processing` state reconnect their WebSocket automatically. Files in `Pending` state that have lost their blob show a "Session Expired" badge with instructions to re-add them.

### Performance
- `StudentsTable` uses server-side keyset pagination — the DOM never holds more than 100 rows.
- `fetchStudents`, `fetchCount`, and all event handlers are wrapped in `useCallback`.
- The table body is wrapped in `useMemo` to skip recalculation on unrelated state changes.

---

## Accessibility

The UI targets **WCAG 2.1 AA** for core functionality:

- Dropzone: `role="button"`, `tabIndex={0}`, keyboard Enter/Space triggers file picker.
- Progress bars: `role="progressbar"` with `aria-valuenow / aria-valuemin / aria-valuemax`.
- Status badges: `aria-live="polite"` so transitions are announced to screen readers.
- Error/warning banners: `role="alert"`.
- Table: `role="grid"`, `aria-sort` on sortable headers, `aria-rowcount`, `aria-busy`.
- Pagination: wrapped in `<nav>`, `aria-label`, `aria-current="page"`.
- All icon-only buttons carry descriptive `aria-label` attributes.
