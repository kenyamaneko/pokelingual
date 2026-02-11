package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kenyamamoto/pokelingual/backend/internal/domain"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
)

// QuestHandler handles HTTP requests for the quest flow.
type QuestHandler struct {
	questService *service.QuestService
	repo         domain.UserPokemonRepository
}

// NewQuestHandler creates a new QuestHandler.
func NewQuestHandler(questService *service.QuestService, repo domain.UserPokemonRepository) *QuestHandler {
	return &QuestHandler{
		questService: questService,
		repo:         repo,
	}
}

// NewQuest handles GET /quest/new to start a new quest with a random Pokemon.
func (h *QuestHandler) NewQuest(c *gin.Context) {
	uid := c.GetString("uid")

	resp, err := h.questService.NewQuest(c.Request.Context(), uid)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ScoreTranslation handles POST /quest/score to score a user's translation.
func (h *QuestHandler) ScoreTranslation(c *gin.Context) {
	uid := c.GetString("uid")

	var req struct {
		Translation string `json:"translation" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "translation is required"})
		return
	}

	resp, err := h.questService.ScoreTranslation(c.Request.Context(), uid, req.Translation)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GuessName handles POST /quest/guess-name to check a Pokemon name guess.
func (h *QuestHandler) GuessName(c *gin.Context) {
	uid := c.GetString("uid")

	var req struct {
		Guess string `json:"guess" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "guess is required"})
		return
	}

	resp, err := h.questService.GuessName(c.Request.Context(), uid, req.Guess)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// AttemptCapture handles POST /quest/capture to attempt capturing the Pokemon.
func (h *QuestHandler) AttemptCapture(c *gin.Context) {
	uid := c.GetString("uid")

	resp, err := h.questService.AttemptCapture(c.Request.Context(), uid)
	if err != nil {
		handleError(c, err)
		return
	}

	if err := h.repo.UpsertEncounter(c.Request.Context(), uid, resp.PokemonID, resp.Score, resp.Captured); err != nil {
		slog.Error("failed to persist encounter", "error", err, "uid", uid, "pokemon_id", resp.PokemonID)
	}

	c.JSON(http.StatusOK, resp)
}
