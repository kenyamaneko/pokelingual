package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kenyamamoto/pokelingual/backend/internal/domain"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
)

// SettingsHandler handles HTTP requests for user settings.
type SettingsHandler struct {
	settingsRepo domain.UserSettingsRepository
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(settingsRepo domain.UserSettingsRepository) *SettingsHandler {
	return &SettingsHandler{
		settingsRepo: settingsRepo,
	}
}

// GetSettings handles GET /settings to retrieve user settings.
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	uid := c.GetString("uid")

	settings, err := h.settingsRepo.GetSettings(c.Request.Context(), uid)
	if err != nil {
		handleError(c, err)
		return
	}

	excluded := settings.ExcludedPokemonIDs
	if excluded == nil {
		excluded = service.DefaultExcludedPokemonIDs
	}

	c.JSON(http.StatusOK, gin.H{
		"excluded_pokemon_ids": excluded,
		"max_pokemon_id":      service.MaxPokemonID,
	})
}

type updateExcludedPokemonRequest struct {
	PokemonIDs []int `json:"pokemon_ids" binding:"required"`
}

// UpdateExcludedPokemon handles PUT /settings/excluded-pokemon.
func (h *SettingsHandler) UpdateExcludedPokemon(c *gin.Context) {
	uid := c.GetString("uid")

	var req updateExcludedPokemonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.settingsRepo.UpdateExcludedPokemon(c.Request.Context(), uid, req.PokemonIDs); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
