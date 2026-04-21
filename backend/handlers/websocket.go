package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var wsOrigins []string

// SetWSOrigins sets allowed origins for WebSocket (called from main.go)
func SetWSOrigins(origins []string) {
	wsOrigins = origins
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // Allow same-origin
		}
		for _, allowed := range wsOrigins {
			if origin == allowed {
				return true
			}
		}
		log.Printf("[WebSocket] Rejected origin: %s", origin)
		return false
	},
}

func (h *Handler) HandleProgressWS(c *gin.Context) {
	fileID := c.Query("fileId")
	log.Printf("WebSocket request received for fileId: %s\n", fileID)
	if fileID == "" {
		log.Println("Missing fileId")
		c.JSON(400, gin.H{"error": "missing fileId"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v\n", err)
		return
	}
	log.Printf("WebSocket upgrade successful for fileID: %s\n", fileID)

	h.ProgressHub.Register(fileID, ws)
	defer h.ProgressHub.Unregister(fileID)
	defer ws.Close()

	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
}
