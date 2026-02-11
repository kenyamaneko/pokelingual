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
	"github.com/kenyamamoto/pokelingual/backend/internal/testutil"
)

func setupSettingsRouter(sh *handler.SettingsHandler) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("uid", "test-user")
		c.Next()
	})
	r.GET("/settings", sh.GetSettings)
	r.PUT("/settings/excluded-pokemon", sh.UpdateExcludedPokemon)
	return r
}

func TestGetSettingsHandler(t *testing.T) {
	// Given: user has excluded Pokemon 167, 168
	settingsRepo := &testutil.MockUserSettingsRepo{
		Settings: &model.UserSettings{ExcludedPokemonIDs: []int{167, 168}},
	}
	sh := handler.NewSettingsHandler(settingsRepo)
	router := setupSettingsRouter(sh)

	// When: GET /settings
	req := httptest.NewRequest("GET", "/settings", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 with excluded IDs
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp model.UserSettings
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if len(resp.ExcludedPokemonIDs) != 2 {
		t.Errorf("expected 2 excluded IDs, got %d", len(resp.ExcludedPokemonIDs))
	}
}

func TestGetSettingsHandler_DefaultEmpty(t *testing.T) {
	// Given: user has no settings (returns default)
	settingsRepo := &testutil.MockUserSettingsRepo{}
	sh := handler.NewSettingsHandler(settingsRepo)
	router := setupSettingsRouter(sh)

	req := httptest.NewRequest("GET", "/settings", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp model.UserSettings
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if len(resp.ExcludedPokemonIDs) != 0 {
		t.Errorf("expected 0 excluded IDs, got %d", len(resp.ExcludedPokemonIDs))
	}
}

func TestUpdateExcludedPokemonHandler(t *testing.T) {
	// Given: settings repo
	settingsRepo := &testutil.MockUserSettingsRepo{}
	sh := handler.NewSettingsHandler(settingsRepo)
	router := setupSettingsRouter(sh)

	// When: PUT /settings/excluded-pokemon with Pokemon IDs
	body, _ := json.Marshal(map[string][]int{"pokemon_ids": {167, 168, 595, 596}})
	req := httptest.NewRequest("PUT", "/settings/excluded-pokemon", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 OK
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status ok, got %s", resp["status"])
	}

	// Verify repo was called correctly
	if len(settingsRepo.UpdateCalls) != 1 {
		t.Fatalf("expected 1 update call, got %d", len(settingsRepo.UpdateCalls))
	}
	call := settingsRepo.UpdateCalls[0]
	if call.UID != "test-user" {
		t.Errorf("expected uid test-user, got %s", call.UID)
	}
	if len(call.PokemonIDs) != 4 {
		t.Errorf("expected 4 pokemon IDs, got %d", len(call.PokemonIDs))
	}
}

func TestUpdateExcludedPokemonHandler_InvalidBody(t *testing.T) {
	settingsRepo := &testutil.MockUserSettingsRepo{}
	sh := handler.NewSettingsHandler(settingsRepo)
	router := setupSettingsRouter(sh)

	// Empty body
	req := httptest.NewRequest("PUT", "/settings/excluded-pokemon", bytes.NewBuffer([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing pokemon_ids, got %d", w.Code)
	}
}

func TestGetSettingsHandler_RepoError(t *testing.T) {
	settingsRepo := &testutil.MockUserSettingsRepo{
		ErrorToReturn: fmt.Errorf("firestore unavailable"),
	}
	sh := handler.NewSettingsHandler(settingsRepo)
	router := setupSettingsRouter(sh)

	req := httptest.NewRequest("GET", "/settings", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestUpdateExcludedPokemonHandler_RepoError(t *testing.T) {
	settingsRepo := &testutil.MockUserSettingsRepo{
		ErrorToReturn: fmt.Errorf("firestore write failed"),
	}
	sh := handler.NewSettingsHandler(settingsRepo)
	router := setupSettingsRouter(sh)

	body, _ := json.Marshal(map[string][]int{"pokemon_ids": {1, 2, 3}})
	req := httptest.NewRequest("PUT", "/settings/excluded-pokemon", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
