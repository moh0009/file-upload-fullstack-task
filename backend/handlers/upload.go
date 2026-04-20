package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/moh0009/file-upload-fullstack-task/backend/config"
	"github.com/moh0009/file-upload-fullstack-task/backend/progress"
	"github.com/moh0009/file-upload-fullstack-task/backend/queue"
	"github.com/moh0009/file-upload-fullstack-task/backend/worker"
	"github.com/redis/go-redis/v9"
)

type Handler struct {
	Cfg         *config.Config
	Db          *pgxpool.Pool
	Queue       *queue.RedisQueue
	WorkerMgr   *worker.WorkerManager
	ProgressHub *progress.RedisProgressHub
	Rdb         *redis.Client
}

func NewHandler(cfg *config.Config, db *pgxpool.Pool, rdb *redis.Client) *Handler {
	handler := &Handler{
		Cfg: cfg,
		Db:  db,
		Rdb: rdb,
	}
	handler.ProgressHub = progress.NewProgressHub(rdb)
	handler.Queue = queue.NewRedisQueue(rdb, cfg.QueueMaxRetries)
	handler.WorkerMgr = worker.NewWorkerManager(rdb, cfg.WorkerCount, handler.ProcessFileWithRedis)
	return handler
}

type ChunkMeta struct {
	ChunkIndex  int    `form:"chunkIndex"`
	TotalChunks int    `form:"totalChunks"`
	FileName    string `form:"fileName"`
	FileID      string `form:"fileId"`
}

func (h *Handler) UploadFiles(c *gin.Context) {
	var meta ChunkMeta
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := c.ShouldBind(&meta); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metadata"})
		return
	}

	// Security: Validate file extension
	if !strings.HasSuffix(strings.ToLower(meta.FileName), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only CSV files are allowed"})
		return
	}

	// Security: Check file size
	if file.Size > h.Cfg.MaxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large"})
		return
	}

	// Security: Validate MIME type
	if file.Header.Get("Content-Type") != "text/csv" && !strings.Contains(file.Header.Get("Content-Type"), "text/csv") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type"})
		return
	}

	chunkPath := filepath.Join(h.Cfg.UploadsDir, fmt.Sprintf("%s.part_%d", meta.FileName, meta.ChunkIndex))
	if err := c.SaveUploadedFile(file, chunkPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save chunk"})
		return
	}

	// Send upload progress to frontend via WebSocket
	progressPct := float64((meta.ChunkIndex + 1)) / float64(meta.TotalChunks) * 100
	if h.ProgressHub != nil {
		h.ProgressHub.Publish(c.Request.Context(), meta.FileID, map[string]interface{}{
			"stage":      "uploading",
			"upload_pct": progressPct,
		})
	}

	if meta.ChunkIndex == meta.TotalChunks-1 {
		if err := h.MergeChunks(meta.FileName, meta.TotalChunks); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to merge chunks"})
			return
		}
		// Send final upload complete message
		if h.ProgressHub != nil {
			h.ProgressHub.Publish(c.Request.Context(), meta.FileID, map[string]interface{}{
				"stage":      "uploading",
				"upload_pct": 100,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "chunk uploaded"})
}

func (h *Handler) MergeChunks(fileName string, totalChunks int) error {
	finalPath := filepath.Join(h.Cfg.UploadsDir, fileName)
	f, err := os.Create(finalPath)
	if err != nil {
		return fmt.Errorf("create final file: %w", err)
	}
	defer f.Close()

	for i := 0; i < totalChunks; i++ {
		chunkPath := filepath.Join(h.Cfg.UploadsDir, fmt.Sprintf("%s.part_%d", fileName, i))
		cf, err := os.Open(chunkPath)
		if err != nil {
			return fmt.Errorf("open chunk %d: %w", i, err)
		}
		_, err = io.Copy(f, cf)
		cf.Close()
		if err != nil {
			return fmt.Errorf("copy chunk %d: %w", i, err)
		}
		os.Remove(chunkPath)
	}
	return nil
}
