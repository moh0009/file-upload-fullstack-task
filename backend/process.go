package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gocarina/gocsv"
	"github.com/jackc/pgx/v5"
)

type Student struct {
	Name    string `csv:"student_name"`
	Subject string `csv:"subject"`
	Grade   int    `csv:"grade"`
}

type ProcessMeta struct {
	FileName string `form:"fileName" json:"fileName"`
	FileID   string `form:"fileId" json:"fileId"`
}

func (s *Student) Validate() error {
	if s.Name == "" {
		return fmt.Errorf("name is required")
	}
	if s.Subject == "" {
		return fmt.Errorf("subject is required")
	}
	if s.Grade < 0 || s.Grade > 100 {
		return fmt.Errorf("invalid grade")
	}
	return nil
}

func (h *Handler) insertBatch(students []Student) error {
	rows := make([][]interface{}, len(students))

	for i, s := range students {
		rows[i] = []interface{}{
			s.Name,
			s.Subject,
			s.Grade,
		}
	}

	_, err := h.db.CopyFrom(
		context.Background(),
		pgx.Identifier{"students"},
		[]string{"name", "subject", "grade"},
		pgx.CopyFromRows(rows),
	)

	return err
}

func (h *Handler) processPost(c *gin.Context) {
	var meta ProcessMeta
	c.ShouldBind(&meta)

	go h.processFile(meta.FileName, meta.FileID)

	c.JSON(http.StatusOK, gin.H{"message": "Processing started"})
}

type progressReader struct {
	io.Reader
	size      int64
	readBytes int64
	fileID    string
	lastProg  int
}

func (pr *progressReader) Read(p []byte) (n int, err error) {
	n, err = pr.Reader.Read(p)
	if n > 0 {
		pr.readBytes += int64(n)
		prog := int(float64(pr.readBytes) / float64(pr.size) * 100)
		if prog > pr.lastProg {
			pr.lastProg = prog
			sendWSMessage(pr.fileID, gin.H{"type": "processing", "progress": prog})
		}
	}
	return n, err
}

func (h *Handler) processFile(fileName string, fileID string) {
	file, err := os.Open("./uploads/" + fileName)
	if err != nil {
		fmt.Println("Error opening file:", err)
		return
	}
	defer file.Close()

	fi, err := file.Stat()
	if err != nil {
		fmt.Println("Error stat file:", err)
		return
	}

	chunkSize := 20000 // tune this
	workerCount := 10  // VERY important
	batch := make([]Student, 0, chunkSize)
	jobs := make(chan []Student)

	var wg sync.WaitGroup

	// start workers
	for range workerCount {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for chunk := range jobs {
				if err := h.insertBatch(chunk); err != nil {
					fmt.Println("Insert error:", err)
				}
			}
		}()
	}

	studentsChan := make(chan Student)
	errChan := make(chan error, 1)

	go func() {
		pr := &progressReader{
			Reader: file,
			size:   fi.Size(),
			fileID: fileID,
		}
		errChan <- gocsv.UnmarshalToChan(pr, studentsChan)
	}()

	for s := range studentsChan {
		if err := s.Validate(); err != nil {
			fmt.Println("Validation error:", err)
			continue
		}
		batch = append(batch, s)

		if len(batch) == chunkSize {
			jobs <- batch
			batch = make([]Student, 0, chunkSize)
		}
	}

	if len(batch) > 0 {
		jobs <- batch
	}
	close(jobs)

	wg.Wait()
	<-errChan

	sendWSMessage(fileID, gin.H{"type": "complete"})
}
