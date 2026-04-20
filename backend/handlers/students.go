package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	apperrors "github.com/moh0009/file-upload-fullstack-task/backend/errors"
)

type StudentDB struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Subject string `json:"subject"`
	Grade   int    `json:"grade"`
}

func (h *Handler) GetStudentsCount(c *gin.Context) {
	nameSearch := c.Query("name")
	subjectSearch := c.Query("subject")
	gradeMinStr := c.Query("gradeMin")
	gradeMaxStr := c.Query("gradeMax")

	query := "SELECT count(*) FROM students"
	whereClauses := []string{}
	var args []interface{}
	argCount := 1

	if nameSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("name LIKE $%d", argCount))
		args = append(args, "%"+nameSearch+"%")
		argCount++
	}
	if subjectSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("subject = $%d", argCount))
		args = append(args, subjectSearch)
		argCount++
	}
	if gradeMinStr != "" {
		val, err := strconv.Atoi(gradeMinStr)
		if err != nil {
			apperrors.Respond(c, apperrors.BadRequest("gradeMin must be an integer"))
			return
		}
		whereClauses = append(whereClauses, fmt.Sprintf("grade >= $%d", argCount))
		args = append(args, val)
		argCount++
	}
	if gradeMaxStr != "" {
		val, err := strconv.Atoi(gradeMaxStr)
		if err != nil {
			apperrors.Respond(c, apperrors.BadRequest("gradeMax must be an integer"))
			return
		}
		whereClauses = append(whereClauses, fmt.Sprintf("grade <= $%d", argCount))
		args = append(args, val)
		argCount++
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	row := h.Db.QueryRow(context.Background(), query, args...)
	var count int
	if err := row.Scan(&count); err != nil {
		apperrors.Respond(c, apperrors.Internal("failed to count student records", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) GetStudents(c *gin.Context) {
	pageSizeStr := c.Query("pageSize")
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 {
		apperrors.Respond(c, apperrors.BadRequest("pageSize must be a positive integer"))
		return
	}

	sortBy := c.Query("sortBy")
	afterIdStr := c.Query("afterId")
	afterValue := c.Query("afterValue")
	beforeIdStr := c.Query("beforeId")
	beforeValue := c.Query("beforeValue")
	nameSearch := c.Query("name")
	subjectSearch := c.Query("subject")
	gradeMinStr := c.Query("gradeMin")
	gradeMaxStr := c.Query("gradeMax")

	// Security: whitelist allowed sort columns
	allowedColumns := map[string]bool{"id": true, "name": true, "subject": true, "grade": true}

	sortCol := "id"
	isDesc := false
	if sortBy != "" {
		parts := strings.Split(strings.TrimSpace(sortBy), " ")
		if allowedColumns[parts[0]] {
			sortCol = parts[0]
		}
		if len(parts) > 1 && strings.ToUpper(parts[1]) == "DESC" {
			isDesc = true
		}
	}

	query := "SELECT id, name, subject, grade FROM students"
	var args []interface{}
	argCount := 1
	whereClauses := []string{}

	if nameSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("name LIKE $%d", argCount))
		args = append(args, "%"+nameSearch+"%")
		argCount++
	}
	if subjectSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("subject = $%d", argCount))
		args = append(args, subjectSearch)
		argCount++
	}
	if gradeMinStr != "" {
		val, err := strconv.Atoi(gradeMinStr)
		if err != nil {
			apperrors.Respond(c, apperrors.BadRequest("gradeMin must be an integer"))
			return
		}
		whereClauses = append(whereClauses, fmt.Sprintf("grade >= $%d", argCount))
		args = append(args, val)
		argCount++
	}
	if gradeMaxStr != "" {
		val, err := strconv.Atoi(gradeMaxStr)
		if err != nil {
			apperrors.Respond(c, apperrors.BadRequest("gradeMax must be an integer"))
			return
		}
		whereClauses = append(whereClauses, fmt.Sprintf("grade <= $%d", argCount))
		args = append(args, val)
		argCount++
	}

	// Keyset pagination
	if afterIdStr != "" {
		afterId, err := strconv.Atoi(afterIdStr)
		if err != nil {
			apperrors.Respond(c, apperrors.BadRequest("afterId must be an integer"))
			return
		}
		if sortCol == "id" {
			op := ">"
			if isDesc {
				op = "<"
			}
			whereClauses = append(whereClauses, fmt.Sprintf("id %s $%d", op, argCount))
			args = append(args, afterId)
			argCount++
		} else {
			operator := ">"
			if isDesc {
				operator = "<"
			}
			whereClauses = append(whereClauses, fmt.Sprintf("(%s, id) %s ($%d, $%d)", sortCol, operator, argCount, argCount+1))
			args = append(args, afterValue, afterId)
			argCount += 2
		}
	} else if beforeIdStr != "" {
		beforeId, err := strconv.Atoi(beforeIdStr)
		if err != nil {
			apperrors.Respond(c, apperrors.BadRequest("beforeId must be an integer"))
			return
		}
		if sortCol == "id" {
			op := "<"
			if isDesc {
				op = ">"
			}
			whereClauses = append(whereClauses, fmt.Sprintf("id %s $%d", op, argCount))
			args = append(args, beforeId)
			argCount++
		} else {
			operator := "<"
			if isDesc {
				operator = ">"
			}
			whereClauses = append(whereClauses, fmt.Sprintf("(%s, id) %s ($%d, $%d)", sortCol, operator, argCount, argCount+1))
			args = append(args, beforeValue, beforeId)
			argCount += 2
		}
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	orderDir := "ASC"
	if isDesc {
		orderDir = "DESC"
	}
	effectiveOrderDir := orderDir
	if beforeIdStr != "" {
		if isDesc {
			effectiveOrderDir = "ASC"
		} else {
			effectiveOrderDir = "DESC"
		}
	}

	if sortCol == "id" {
		query += fmt.Sprintf(" ORDER BY id %s", effectiveOrderDir)
	} else {
		query += fmt.Sprintf(" ORDER BY %s %s, id %s", sortCol, effectiveOrderDir, effectiveOrderDir)
	}

	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, pageSize)

	rows, err := h.Db.Query(context.Background(), query, args...)
	if err != nil {
		apperrors.Respond(c, apperrors.Internal("failed to query student records", err))
		return
	}
	defer rows.Close()

	var students []StudentDB
	for rows.Next() {
		var student StudentDB
		if err := rows.Scan(&student.ID, &student.Name, &student.Subject, &student.Grade); err != nil {
			apperrors.Respond(c, apperrors.Internal("failed to read student record", err))
			return
		}
		students = append(students, student)
	}

	// Reverse for backward pagination
	if beforeIdStr != "" {
		for i, j := 0, len(students)-1; i < j; i, j = i+1, j-1 {
			students[i], students[j] = students[j], students[i]
		}
	}

	// Return empty array instead of null
	if students == nil {
		students = []StudentDB{}
	}

	c.JSON(http.StatusOK, students)
}

func (h *Handler) DeleteStudent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		apperrors.Respond(c, apperrors.BadRequest("student ID must be an integer"))
		return
	}

	result, err := h.Db.Exec(context.Background(), "DELETE FROM students WHERE id = $1", id)
	if err != nil {
		apperrors.Respond(c, apperrors.Internal("failed to delete student", err))
		return
	}
	if result.RowsAffected() == 0 {
		apperrors.Respond(c, apperrors.NotFound(fmt.Sprintf("no student found with id %d", id)))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "student deleted successfully"})
}

func (h *Handler) UpdateStudent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		apperrors.Respond(c, apperrors.BadRequest("student ID must be an integer"))
		return
	}

	var student StudentDB
	if err := c.ShouldBindJSON(&student); err != nil {
		apperrors.Respond(c, apperrors.BadRequest("invalid request body: name, subject, and grade are required", err))
		return
	}

	result, err := h.Db.Exec(
		context.Background(),
		"UPDATE students SET name = $1, subject = $2, grade = $3 WHERE id = $4",
		student.Name, student.Subject, student.Grade, id,
	)
	if err != nil {
		apperrors.Respond(c, apperrors.Internal("failed to update student", err))
		return
	}
	if result.RowsAffected() == 0 {
		apperrors.Respond(c, apperrors.NotFound(fmt.Sprintf("no student found with id %d", id)))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "student updated successfully"})
}
