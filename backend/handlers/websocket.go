package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// TODO: In production, validate origin against allowed domains
		// For now, allowing localhost for development
		origin := r.Header.Get("Origin")
		return origin == "http://localhost:3000" || origin == "http://localhost:3001"
	},
	Error: func(w http.ResponseWriter, r *http.Request, status int, reason error) {
		fmt.Printf("WebSocket upgrade error: status=%d, reason=%v\n", status, reason)
	},
}

func (h *Handler) HandleProgressWS(c *gin.Context) {
	fileID := c.Query("fileId")
	fmt.Printf("WebSocket request received for fileId: %s\n", fileID)
	if fileID == "" {
		fmt.Println("Missing fileId")
		c.JSON(400, gin.H{"error": "missing fileId"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Printf("WebSocket upgrade failed: %v\n", err)
		return
	}
	fmt.Printf("WebSocket upgrade successful for fileID: %s\n", fileID)

	h.ProgressHub.Register(fileID, ws)
	defer h.ProgressHub.Unregister(fileID)
	defer ws.Close()

	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
}
