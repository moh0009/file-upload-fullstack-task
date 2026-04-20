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
	apperrors "github.com/moh0009/file-upload-fullstack-task/backend/errors"
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
		apperrors.Respond(c, apperrors.BadRequest("file field is required in the multipart form", err))
		return
	}

	if err := c.ShouldBind(&meta); err != nil {
		apperrors.Respond(c, apperrors.BadRequest("invalid chunk metadata", err))
		return
	}

	// Validate file extension
	if !strings.HasSuffix(strings.ToLower(meta.FileName), ".csv") {
		apperrors.Respond(c, apperrors.BadRequest("only CSV files are allowed"))
		return
	}

	// Validate file size
	if file.Size > h.Cfg.MaxFileSize {
		apperrors.Respond(c, apperrors.BadRequest(
			fmt.Sprintf("file exceeds maximum allowed size of %d bytes", h.Cfg.MaxFileSize),
		))
		return
	}

	chunkPath := filepath.Join(h.Cfg.UploadsDir, fmt.Sprintf("%s.part_%d", meta.FileName, meta.ChunkIndex))
	if err := c.SaveUploadedFile(file, chunkPath); err != nil {
		apperrors.Respond(c, apperrors.Internal(
			fmt.Sprintf("failed to save chunk %d of %s", meta.ChunkIndex, meta.FileName), err,
		))
		return
	}

	// Report upload progress to the frontend via WebSocket
	progressPct := float64(meta.ChunkIndex+1) / float64(meta.TotalChunks) * 100
	if h.ProgressHub != nil {
		h.ProgressHub.Publish(c.Request.Context(), meta.FileID, map[string]interface{}{
			"stage":      "uploading",
			"upload_pct": progressPct,
		})
	}

	if meta.ChunkIndex == meta.TotalChunks-1 {
		if err := h.MergeChunks(meta.FileName, meta.TotalChunks); err != nil {
			apperrors.Respond(c, apperrors.Internal(
				fmt.Sprintf("failed to merge chunks for %s", meta.FileName), err,
			))
			return
		}
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
		return fmt.Errorf("create final file %q: %w", finalPath, err)
	}
	defer f.Close()

	for i := 0; i < totalChunks; i++ {
		chunkPath := filepath.Join(h.Cfg.UploadsDir, fmt.Sprintf("%s.part_%d", fileName, i))
		cf, err := os.Open(chunkPath)
		if err != nil {
			return fmt.Errorf("open chunk %d of %q: %w", i, fileName, err)
		}
		_, copyErr := io.Copy(f, cf)
		cf.Close()
		if copyErr != nil {
			return fmt.Errorf("copy chunk %d of %q: %w", i, fileName, copyErr)
		}
		os.Remove(chunkPath)
	}
	return nil
}
