package handlers

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	apperrors "github.com/moh0009/file-upload-fullstack-task/backend/errors"
	"github.com/moh0009/file-upload-fullstack-task/backend/progress"
	"github.com/moh0009/file-upload-fullstack-task/backend/queue"
	"golang.org/x/sync/errgroup"
)

type ProcessMeta struct {
	FileName string `form:"fileName" json:"fileName"`
	FileID   string `form:"fileId"   json:"fileId"`
	UserID   string `form:"userId"   json:"userId"`
}

func (h *Handler) ProcessPost(c *gin.Context) {
	var meta ProcessMeta
	if err := c.ShouldBind(&meta); err != nil {
		apperrors.Respond(c, apperrors.BadRequest("invalid process request body", err))
		return
	}
	if meta.FileName == "" {
		apperrors.Respond(c, apperrors.BadRequest("fileName is required"))
		return
	}
	if meta.FileID == "" {
		apperrors.Respond(c, apperrors.BadRequest("fileId is required"))
		return
	}

	job := &queue.ProcessJob{
		ID:       meta.FileID,
		UserID:   meta.UserID,
		FileName: meta.FileName,
	}

	if err := h.Queue.Enqueue(c.Request.Context(), job); err != nil {
		apperrors.Respond(c, apperrors.ServiceUnavailable("processing queue is full, please try again shortly", err))
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"job_id":      meta.FileID,
		"message":     "queued for processing",
		"progress_ws": fmt.Sprintf("/ws/progress?fileId=%s", meta.FileID),
	})
}

func (h *Handler) ProcessFileWithRedis(ctx context.Context, job *queue.ProcessJob) error {
	tracker := NewProgressTracker(h.ProgressHub, job.ID)
	defer tracker.Complete()

	filePath := filepath.Join("./uploads", job.FileName)
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open uploaded file %q: %w", job.FileName, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat uploaded file %q: %w", job.FileName, err)
	}

	pr := NewProgressReader(bufio.NewReaderSize(file, 64*1024), tracker, info.Size())
	if err := h.CopyToStaging(ctx, pr); err != nil {
		return fmt.Errorf("copy %q to staging: %w", job.FileName, err)
	}

	tracker.Update("moving", 100, 0, nil)
	if err := h.MoveToMainTableParallel(ctx, tracker); err != nil {
		return fmt.Errorf("move staging rows to students table: %w", err)
	}

	os.Remove(filePath)
	tracker.Update("complete", 100, 100, nil)
	return nil
}

func (h *Handler) CopyToStaging(ctx context.Context, pr io.Reader) error {
	conn, err := h.Db.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire db connection: %w", err)
	}
	defer conn.Release()

	_, err = conn.Conn().PgConn().CopyFrom(
		ctx, pr,
		"COPY students_staging (id, name, subject, grade) FROM STDIN WITH (FORMAT csv, HEADER true)",
	)
	if err != nil && err != io.EOF {
		return fmt.Errorf("COPY FROM STDIN: %w", err)
	}
	return nil
}

func (h *Handler) MoveToMainTableParallel(ctx context.Context, tracker *ProgressTracker) error {
	const batchSize = 10000
	const maxWorkers = 4

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(maxWorkers)

	var total int64
	if err := h.Db.QueryRow(ctx, "SELECT count(*) FROM students_staging").Scan(&total); err != nil {
		return fmt.Errorf("count staging rows: %w", err)
	}
	tracker.SetTotal(total)
	tracker.Update("moving", 100, 0, nil)

	for offset := int64(0); offset < total; offset += batchSize {
		g.Go(func() error {
			rows, err := h.ProcessBatchCTE(ctx, batchSize)
			if err != nil {
				return fmt.Errorf("process batch at offset %d: %w", offset, err)
			}
			// Early-exit: if the staging table is now empty, nothing more to do.
			if rows == 0 {
				return nil
			}
			tracker.AddRows(rows)
			processed := atomic.LoadInt64(&tracker.processed)
			totalAtomic := atomic.LoadInt64(&tracker.total)
			if totalAtomic > 0 {
				pct := float64(processed) / float64(totalAtomic) * 100
				tracker.Update("moving", 100, pct, nil)
			}
			return nil
		})
	}
	return g.Wait()
}

func (h *Handler) ProcessBatchCTE(ctx context.Context, limit int) (int64, error) {
	var moved int64
	err := h.Db.QueryRow(ctx, `
		WITH validated AS (
			SELECT ctid, name, subject, CAST(grade AS INTEGER) as grade_int
			FROM students_staging
			WHERE name IS NOT NULL AND btrim(name) != ''
			  AND subject IS NOT NULL AND btrim(subject) != ''
			  AND grade ~ '^[0-9]+$'
			LIMIT $1
		),
		deleted AS (
			DELETE FROM students_staging s
			USING validated v
			WHERE s.ctid = v.ctid
			RETURNING v.name, v.subject, v.grade_int
		),
		inserted AS (
			INSERT INTO students (name, subject, grade)
			SELECT name, subject, grade_int FROM deleted
			RETURNING 1
		)
		SELECT COUNT(*) FROM inserted;
	`, limit).Scan(&moved)
	if err != nil {
		return 0, fmt.Errorf("CTE batch upsert: %w", err)
	}
	return moved, nil
}

// ─────────────────────── PROGRESS TRACKER ───────────────────────────────────

type ProgressTracker struct {
	hub       *progress.RedisProgressHub
	jobID     string
	total     int64
	processed int64
	lastPct   int
	throttle  time.Duration
	lastSend  time.Time
	lastStage string
	mu        sync.Mutex
}

func NewProgressTracker(hub *progress.RedisProgressHub, jobID string) *ProgressTracker {
	return &ProgressTracker{
		hub:      hub,
		jobID:    jobID,
		throttle: 200 * time.Millisecond,
	}
}

func (p *ProgressTracker) SetTotal(n int64) { atomic.StoreInt64(&p.total, n) }
func (p *ProgressTracker) AddRows(n int64)  { atomic.AddInt64(&p.processed, n) }

func (p *ProgressTracker) Update(stage string, upPct, procPct float64, extra map[string]interface{}) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Bypass throttle on stage change or final update
	if stage == p.lastStage && stage != "complete" && time.Since(p.lastSend) < p.throttle {
		return
	}
	p.lastSend = time.Now()
	p.lastStage = stage

	data := map[string]interface{}{
		"stage":       stage,
		"upload_pct":  upPct,
		"process_pct": procPct,
		"rows":        atomic.LoadInt64(&p.processed),
	}
	for k, v := range extra {
		data[k] = v
	}
	_ = p.hub.Publish(context.Background(), p.jobID, data)
}

func (p *ProgressTracker) Complete() {
	p.Update("complete", 100, 100, nil)
}

// ─────────────────────── PROGRESS READER ────────────────────────────────────

type ProgressReader struct {
	io.Reader
	tracker *ProgressTracker
	size    int64
	read    int64
}

func NewProgressReader(r io.Reader, t *ProgressTracker, size int64) *ProgressReader {
	return &ProgressReader{Reader: r, tracker: t, size: size}
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	if n > 0 {
		atomic.AddInt64(&pr.read, int64(n))
		read := atomic.LoadInt64(&pr.read)
		pct := float64(read) / float64(pr.size) * 100
		pr.tracker.Update("parsing", pct, 0, nil)
	}
	return n, err
}
