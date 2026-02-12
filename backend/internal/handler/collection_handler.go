package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kenyamamoto/pokelingual/backend/internal/domain"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
)

// CollectionHandler handles HTTP requests for the Pokemon collection.
type CollectionHandler struct {
	collectionService *service.CollectionService
	settingsRepo      domain.UserSettingsRepository
}

// NewCollectionHandler creates a new CollectionHandler.
func NewCollectionHandler(collectionService *service.CollectionService, settingsRepo domain.UserSettingsRepository) *CollectionHandler {
	return &CollectionHandler{
		collectionService: collectionService,
		settingsRepo:      settingsRepo,
	}
}

// GetCollection handles GET /collection to list the user's discovered Pokemon.
func (h *CollectionHandler) GetCollection(c *gin.Context) {
	uid := c.GetString("uid")

	entries, err := h.collectionService.GetCollection(c.Request.Context(), uid)
	if err != nil {
		handleError(c, err)
		return
	}

	totalAvailable := service.MaxPokemonID

	capturedCount := 0
	for _, e := range entries {
		if e.Status == "captured" {
			capturedCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"pokemon":         entries,
		"total_available": totalAvailable,
		"captured_count":  capturedCount,
	})
}

// GetPokemonDetail handles GET /collection/:id to get details of a captured Pokemon.
func (h *CollectionHandler) GetPokemonDetail(c *gin.Context) {
	uid := c.GetString("uid")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pokemon id"})
		return
	}

	detail, err := h.collectionService.GetPokemonDetail(c.Request.Context(), uid, id)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, detail)
}
