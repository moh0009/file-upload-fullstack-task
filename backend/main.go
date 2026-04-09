package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

var (
	clients   = make(map[string]*websocket.Conn)
	clientsMu sync.Mutex
)

func sendWSMessage(fileID string, msg interface{}) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	if ws, ok := clients[fileID]; ok {
		ws.WriteJSON(msg)
	}
}

type ChunkMeta struct {
	ChunkIndex  int    `form:"chunkIndex"`
	TotalChunks int    `form:"totalChunks"`
	FileName    string `form:"fileName"`
	FileID      string `form:"fileId"`
}

type MergeMeta struct {
	FileName    string `form:"fileName"`
	TotalChunks int    `form:"totalChunks"`
}

type Handler struct {
	db *pgxpool.Pool
}

func MergeChunks(fileName string, totalChunks int) error {
	finalPath := "./uploads/" + fileName

	finalFile, err := os.Create(finalPath)
	if err != nil {
		return err
	}
	defer finalFile.Close()

	for i := range totalChunks {
		chunkPath := fmt.Sprintf("./uploads/%s.part_%d", fileName, i)

		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			return err
		}
		_, err = io.Copy(finalFile, chunkFile)
		chunkFile.Close()
		if err != nil {
			return err
		}

		os.Remove(chunkPath) // cleanup
	}

	return nil
}

func uploadFiles(c *gin.Context) {
	var meta ChunkMeta

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	c.ShouldBind(&meta)
	if !strings.HasSuffix(strings.ToLower(meta.FileName), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type"})
		return
	}

	chunkPath := fmt.Sprintf("./uploads/%s.part_%d", meta.FileName, meta.ChunkIndex)

	if err := c.SaveUploadedFile(file, chunkPath); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	progress := int(float64(meta.ChunkIndex+1) / float64(meta.TotalChunks) * 100)

	sendWSMessage(meta.FileID, gin.H{"type": "upload", "progress": progress})

	if meta.ChunkIndex == meta.TotalChunks-1 {
		err := MergeChunks(meta.FileName, meta.TotalChunks)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "All files uploaded successfully, Processing ..."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "file Uploaded successfully"})
}

func handleProgressWS(c *gin.Context) {
	fileID := c.Query("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fileId is required"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Println("Error upgrading to websocket:", err)
		return
	}

	clientsMu.Lock()
	clients[fileID] = ws
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		delete(clients, fileID)
		clientsMu.Unlock()
		ws.Close()
	}()

	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
}

func main() {
	// db conniction
	dbpool, err := pgxpool.New(context.Background(), "postgres://root:toor@localhost:5432/pace_db")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to create connection pool: %v\n", err)
		os.Exit(1)
	}
	defer dbpool.Close()
	handler := &Handler{db: dbpool}
	router := gin.Default()
	router.Use(cors.Default())
	{
		api := router.Group("/api")
		api.POST("/upload", uploadFiles)
		api.GET("/ws/progress", handleProgressWS)
		api.POST("/process", handler.processPost)
	}
	router.Run(":8080")
}
