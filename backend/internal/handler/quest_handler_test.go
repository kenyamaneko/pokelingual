package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/kenyamamoto/pokelingual/backend/internal/handler"
	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
	"github.com/kenyamamoto/pokelingual/backend/internal/testutil"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupTestRouter(h *handler.QuestHandler) *gin.Engine {
	return setupTestRouterWithUID(h, "test-user")
}

func setupTestRouterWithUID(h *handler.QuestHandler, uid string) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("uid", uid)
		c.Next()
	})
	r.GET("/quest/new", h.NewQuest)
	r.POST("/quest/score", h.ScoreTranslation)
	r.POST("/quest/guess-name", h.GuessName)
	r.POST("/quest/capture", h.AttemptCapture)
	r.POST("/quest/chat", h.Chat)
	return r
}

func TestNewQuestHandler(t *testing.T) {
	// Given: a quest handler with a mock fetcher returning Pikachu
	pokemon := &model.Pokemon{
		ID:            25,
		NameEN:        "Pikachu",
		NameJA:        "ピカチュウ",
		DescriptionEN: "It stores electricity in its cheeks.",
		SpriteURL:     "https://example.com/pikachu.png",
		BaseStatTotal: 320,
		Types:         []string{"electric"},
		Height:        4,
		Weight:        60,
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: GET /quest/new is called
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 with the correct pokemon_id
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp service.QuestNewResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.PokemonID != 25 {
		t.Errorf("expected pokemon_id 25, got %d", resp.PokemonID)
	}
}

func TestScoreTranslationHandler(t *testing.T) {
	// Given: a quest session exists and scorer returns 75
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "Test description", SpriteURL: "https://example.com/25.png",
		BaseStatTotal: 320,
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 75, ReviewToReturn: "テスト レビュー"}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// When: POST /quest/score with a translation
	body, _ := json.Marshal(map[string]string{"translation": "テスト翻訳"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 with score 75 and review
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp service.ScoreResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Score != 75 {
		t.Errorf("expected score 75, got %f", resp.Score)
	}
	if resp.Review != "テスト レビュー" {
		t.Errorf("expected review %q, got %q", "テスト レビュー", resp.Review)
	}
}

func TestScoreTranslationHandler_MissingBody(t *testing.T) {
	// Given: a quest handler
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x", BaseStatTotal: 318}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: POST /quest/score with empty body (no translation field)
	req := httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing translation, got %d", w.Code)
	}
}

func TestCaptureHandler_PersistsToRepo(t *testing.T) {
	// Given: a completed quest flow (new → score 100 → capture)
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "Test", SpriteURL: "https://example.com/25.png",
		BaseStatTotal: 320,
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 100}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body, _ := json.Marshal(map[string]string{"translation": "テスト"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// When: POST /quest/capture is called
	req = httptest.NewRequest("POST", "/quest/capture", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 and persists the result to the repository
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if len(repo.UpsertCalls) != 1 {
		t.Fatalf("expected 1 upsert call, got %d", len(repo.UpsertCalls))
	}
	call := repo.UpsertCalls[0]
	if call.UID != "test-user" {
		t.Errorf("expected uid test-user, got %s", call.UID)
	}
	if call.PokemonID != 25 {
		t.Errorf("expected pokemon_id 25, got %d", call.PokemonID)
	}
}

func TestNewQuestHandler_ExternalServiceError(t *testing.T) {
	// Given: a fetcher that returns an error (PokeAPI down)
	fetcher := &testutil.MockPokemonFetcher{ErrorToReturn: fmt.Errorf("connection refused")}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: GET /quest/new is called
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 502 Bad Gateway (external service failure)
	if w.Code != http.StatusBadGateway {
		t.Errorf("expected 502, got %d: %s", w.Code, w.Body.String())
	}
}

func TestScoreTranslationHandler_NoSession(t *testing.T) {
	// Given: no quest session exists
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x", BaseStatTotal: 318}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: POST /quest/score without starting a quest first
	body, _ := json.Marshal(map[string]string{"translation": "テスト"})
	req := httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 404 Not Found (no active session)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCaptureHandler_NoSession(t *testing.T) {
	// Given: no quest session exists
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x", BaseStatTotal: 318}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: POST /quest/capture without an active session
	req := httptest.NewRequest("POST", "/quest/capture", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 404 Not Found
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCaptureHandler_ErrorMessageHidden(t *testing.T) {
	// Given: no quest session exists
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x", BaseStatTotal: 318}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: POST /quest/capture without an active session
	req := httptest.NewRequest("POST", "/quest/capture", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: error message does not leak internal details
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["error"] != "resource not found" {
		t.Errorf("expected generic error message, got %q", resp["error"])
	}
}

func TestChatHandler(t *testing.T) {
	// Given: a quest handler with a mock scorer that returns a chat response
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ", DescriptionEN: "test", SpriteURL: "x", BaseStatTotal: 320}}
	scorer := &testutil.MockAIScorer{ChatResponseToReturn: "「emit」は 放出する という 意味だよ。"}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: POST /quest/chat with context and messages
	chatReq := service.ChatRequest{
		Context: model.ChatContext{
			DescriptionEN: "It stores electricity in its cheeks.",
			DescriptionJA: "ほっぺに でんきを ためている。",
			Translation:   "ほっぺに 電気を ためている。",
			Score:         80,
			Review:        "よく 頑張ったな！",
			NameEN:        "Pikachu",
			NameJA:        "ピカチュウ",
		},
		Messages: []model.ChatMessage{
			{Role: "user", Content: "emitってどういう意味？"},
		},
	}
	body, _ := json.Marshal(chatReq)
	req := httptest.NewRequest("POST", "/quest/chat", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 with professor's reply
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp service.ChatResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp.Reply != "「emit」は 放出する という 意味だよ。" {
		t.Errorf("expected chat reply, got %q", resp.Reply)
	}
}

func TestChatHandler_EmptyMessages(t *testing.T) {
	// Given: a quest handler
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x", BaseStatTotal: 318}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo, scorer)
	router := setupTestRouter(h)

	// When: POST /quest/chat with empty messages
	chatReq := map[string]interface{}{
		"context":  model.ChatContext{},
		"messages": []model.ChatMessage{},
	}
	body, _ := json.Marshal(chatReq)
	req := httptest.NewRequest("POST", "/quest/chat", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 400 Bad Request
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty messages, got %d: %s", w.Code, w.Body.String())
	}
}
