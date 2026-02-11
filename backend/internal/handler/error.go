package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kenyamamoto/pokelingual/backend/internal/apperror"
)

func handleError(c *gin.Context, err error) {
	var extErr *apperror.ExternalServiceError

	switch {
	case errors.Is(err, apperror.ErrNotFound):
		slog.Warn("resource not found", "error", err, "path", c.Request.URL.Path)
		c.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
	case errors.As(err, &extErr):
		slog.Error("external service error", "service", extErr.Service, "error", extErr.Err, "path", c.Request.URL.Path)
		c.JSON(http.StatusBadGateway, gin.H{"error": "external service unavailable"})
	default:
		slog.Error("internal error", "error", err, "path", c.Request.URL.Path)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}
