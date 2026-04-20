// Package apperrors defines structured error types and response helpers used
// across all HTTP handlers. Using a centralised error package ensures every
// error surface returns a consistent JSON body and an appropriate HTTP status,
// and keeps business logic separated from HTTP concerns.
package apperrors

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// AppError is a structured application error that pairs a human-readable
// message with an HTTP status code and an optional underlying cause.
type AppError struct {
	Code    int    // HTTP status code to respond with
	Message string // user-facing message (never exposes internals)
	Cause   error  // internal cause for server-side logging (never serialised)
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

// Unwrap allows errors.Is / errors.As to traverse the cause chain.
func (e *AppError) Unwrap() error { return e.Cause }

// ─── Constructors ─────────────────────────────────────────────────────────────

// BadRequest returns a 400 AppError with the supplied message.
// Use for invalid input that the client can fix.
func BadRequest(msg string, cause ...error) *AppError {
	return newAppError(http.StatusBadRequest, msg, cause...)
}

// NotFound returns a 404 AppError.
func NotFound(msg string, cause ...error) *AppError {
	return newAppError(http.StatusNotFound, msg, cause...)
}

// Internal returns a 500 AppError with a generic user message.
// The real cause is logged server-side but never sent to the client.
func Internal(msg string, cause ...error) *AppError {
	return newAppError(http.StatusInternalServerError, msg, cause...)
}

// ServiceUnavailable returns a 503 AppError.
func ServiceUnavailable(msg string, cause ...error) *AppError {
	return newAppError(http.StatusServiceUnavailable, msg, cause...)
}

func newAppError(code int, msg string, cause ...error) *AppError {
	ae := &AppError{Code: code, Message: msg}
	if len(cause) > 0 {
		ae.Cause = cause[0]
	}
	return ae
}

// ─── Response helper ──────────────────────────────────────────────────────────

// Respond writes the appropriate JSON error response for err.
//
// If err is an *AppError the status code and user-facing message from the
// struct are used. The internal Cause (if any) is logged but not exposed.
//
// Any other error is treated as an unexpected internal server error.
func Respond(c *gin.Context, err error) {
	var ae *AppError
	if errors.As(err, &ae) {
		if ae.Cause != nil {
			log.Printf("[%d] %s: %v", ae.Code, ae.Message, ae.Cause)
		}
		c.JSON(ae.Code, gin.H{"error": ae.Message})
		return
	}
	// Unexpected error — log full detail, return generic message
	log.Printf("[500] unexpected error: %v", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "An unexpected error occurred"})
}
