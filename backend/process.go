package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Student struct {
	Name    string
	Subject string
	Grade   int
}

type ProcessMeta struct {
	FileName string `form:"fileName" json:"fileName"`
	FileID   string `form:"fileId" json:"fileId"`
}

type progressReader struct {
	io.Reader
	size      int64
	readBytes int64
	fileID    string
	lastProg  int
}

// -------------------- API --------------------

func (h *Handler) processPost(c *gin.Context) {
	var meta ProcessMeta
	if err := c.ShouldBind(&meta); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	go h.processFile(meta.FileName, meta.FileID)

	c.JSON(http.StatusOK, gin.H{"message": "Processing started"})
}

// -------------------- MAIN PIPELINE --------------------

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

	ctx := context.Background()

	pr := &progressReader{
		Reader: file,
		size:   fi.Size(),
		fileID: fileID,
	}

	reader := csv.NewReader(pr)

	// ---------------- HEADER ----------------
	if _, err := reader.Read(); err != nil {
		fmt.Println("Header error:", err)
		return
	}

	// ---------------- COPY ----------------
	_, err = h.db.CopyFrom(
		ctx,
		pgx.Identifier{"students_staging"},
		[]string{"name", "subject", "grade"},
		pgx.CopyFromFunc(func() ([]interface{}, error) {

			record, err := reader.Read()
			if err != nil {
				if err == io.EOF {
					return nil, err
				}
				return nil, err
			}

			// CSV format:
			// 0 = student_id (ignore)
			// 1 = student_name
			// 2 = subject
			// 3 = grade

			if len(record) < 4 {
				return nil, nil
			}

			grade, err := strconv.Atoi(record[3])
			if err != nil {
				return nil, nil
			}

			name := record[1]
			subject := record[2]

			if name == "" || subject == "" {
				return nil, nil
			}

			return []interface{}{
				name,
				subject,
				grade,
			}, nil
		}),
	)

	if err != nil && err != io.EOF {
		fmt.Println("COPY error:", err)
		return
	}

	// ---------------- VERIFY STAGING ----------------
	var count int
	_ = h.db.QueryRow(ctx, "SELECT COUNT(*) FROM students_staging").Scan(&count)
	fmt.Println("Rows inserted into staging:", count)

	// ---------------- MOVE TO MAIN ----------------
	if err := h.moveToMainTable(ctx); err != nil {
		fmt.Println("Move error:", err)
		return
	}

	// ---------------- CLEANUP ----------------
	os.Remove("./uploads/" + fileName)
	sendWSMessage(fileID, gin.H{"type": "complete"})
}

// -------------------- MOVE DATA --------------------

func (h *Handler) moveToMainTable(ctx context.Context) error {
	for {
		cmd, err := h.db.Exec(ctx, `
			INSERT INTO students(name, subject, grade)
			SELECT name, subject, grade
			FROM students_staging
			LIMIT 10000;
		`)
		if err != nil {
			return err
		}

		if cmd.RowsAffected() == 0 {
			break
		}

		_, err = h.db.Exec(ctx, `
			DELETE FROM students_staging
			WHERE ctid IN (
				SELECT ctid FROM students_staging LIMIT 10000
			);
		`)
		if err != nil {
			return err
		}
	}
	return nil
}

// -------------------- VALIDATION --------------------

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

// -------------------- PROGRESS --------------------

func (pr *progressReader) Read(p []byte) (n int, err error) {
	n, err = pr.Reader.Read(p)

	if n > 0 {
		pr.readBytes += int64(n)

		prog := int(float64(pr.readBytes) / float64(pr.size) * 100)

		if prog > pr.lastProg {
			pr.lastProg = prog
			sendWSMessage(pr.fileID, gin.H{
				"type":     "processing",
				"progress": prog,
			})
		}
	}

	return n, err
}
