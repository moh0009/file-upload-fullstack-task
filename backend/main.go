package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/moh0009/PACE-platform/backend/config"
	"github.com/moh0009/PACE-platform/backend/handlers"
)

func GetCORSOrigins() []string {
	if os.Getenv("ENVIRONMENT") == "docker" {
		// In Docker, frontend service is accessible by its service name
		return []string{
			"http://frontend:3000",
			"http://frontend:3001",
		}
	}
	// Local development
	return []string{
		"http://localhost:3000",
		"http://localhost:3001",
	}
}

func main() {
	// Load configuration from environment variables
	cfg := config.Load()

	// Initialize database and Redis connections
	db := cfg.InitDatabase()
	defer db.Close()

	rdb := cfg.InitRedis()
	defer rdb.Close()

	// Create handler with all dependencies
	handler := handlers.NewHandler(cfg, db, rdb)

	// Start worker manager for background processing
	handler.WorkerMgr.Start()
	defer handler.WorkerMgr.Shutdown()

	// Setup CORS with security restrictions (restrict to specific origins in production)
	corsConfig := cors.Config{
		AllowOrigins:     GetCORSOrigins(),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}

	// Create router with CORS middleware
	router := gin.Default()
	router.Use(cors.New(corsConfig))

	// Health check ping
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API routes for file upload and processing
	api := router.Group("/api")
	api.POST("/upload", handler.UploadFiles)
	api.POST("/process", handler.ProcessPost)
	api.GET("/ws/progress", handler.HandleProgressWS)

	// Student management routes
	students := api.Group("/students")
	students.GET("/count", handler.GetStudentsCount)
	students.GET("", handler.GetStudents)
	students.DELETE("/:id", handler.DeleteStudent)
	students.PUT("/:id", handler.UpdateStudent)

	// Ensure uploads directory exists
	if _, err := os.Stat(cfg.UploadsDir); os.IsNotExist(err) {
		os.Mkdir(cfg.UploadsDir, 0755)
	}

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: router,
	}

	go func() {
		log.Printf("Server starting on port %s\n", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown
	handler.ProgressHub.Shutdown()
	if err := srv.Shutdown(context.Background()); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
