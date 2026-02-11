package handler_test

import (
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

func setupCollectionRouter(ch *handler.CollectionHandler) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("uid", "test-user")
		c.Next()
	})
	r.GET("/collection", ch.GetCollection)
	r.GET("/collection/:id", ch.GetPokemonDetail)
	return r
}

func TestGetCollectionHandler(t *testing.T) {
	// Given: a user with 2 captured and 1 seen Pokemon
	repo := &testutil.MockUserPokemonRepo{
		Collection: []model.UserPokemon{
			{PokemonID: 25, Status: "captured", TotalCaptures: 3, BestScore: 90},
			{PokemonID: 1, Status: "captured", TotalCaptures: 1, BestScore: 75},
			{PokemonID: 4, Status: "seen", TotalCaptures: 0, BestScore: 60},
		},
	}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: &model.Pokemon{
			ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
			SpriteURL: "https://example.com/25.png",
		},
	}
	settingsRepo := &testutil.MockUserSettingsRepo{}
	collectionSvc := service.NewCollectionService(repo, fetcher)
	ch := handler.NewCollectionHandler(collectionSvc, settingsRepo)
	router := setupCollectionRouter(ch)

	// When: GET /collection
	req := httptest.NewRequest("GET", "/collection", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 with all 3 Pokemon
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Pokemon        []service.CollectionEntry `json:"pokemon"`
		TotalAvailable int                       `json:"total_available"`
		CapturedCount  int                       `json:"captured_count"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if len(resp.Pokemon) != 3 {
		t.Errorf("expected 3 pokemon, got %d", len(resp.Pokemon))
	}
	if resp.CapturedCount != 2 {
		t.Errorf("expected captured_count 2, got %d", resp.CapturedCount)
	}
	if resp.TotalAvailable <= 0 {
		t.Errorf("expected positive total_available, got %d", resp.TotalAvailable)
	}
}

func TestGetCollectionHandler_WithExclusions(t *testing.T) {
	// Given: user has excluded 2 Pokemon
	repo := &testutil.MockUserPokemonRepo{
		Collection: []model.UserPokemon{},
	}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", SpriteURL: "x"},
	}
	settingsRepo := &testutil.MockUserSettingsRepo{
		Settings: &model.UserSettings{ExcludedPokemonIDs: []int{100, 200}},
	}
	collectionSvc := service.NewCollectionService(repo, fetcher)
	ch := handler.NewCollectionHandler(collectionSvc, settingsRepo)
	router := setupCollectionRouter(ch)

	req := httptest.NewRequest("GET", "/collection", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		TotalAvailable int `json:"total_available"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)

	// TotalAvailable should be less than MaxPokemonID due to exclusions
	if resp.TotalAvailable >= service.MaxPokemonID {
		t.Errorf("expected total_available < %d with exclusions, got %d", service.MaxPokemonID, resp.TotalAvailable)
	}
}

func TestGetCollectionHandler_Empty(t *testing.T) {
	// Given: user with no Pokemon
	repo := &testutil.MockUserPokemonRepo{
		Collection: []model.UserPokemon{},
	}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", SpriteURL: "x"},
	}
	settingsRepo := &testutil.MockUserSettingsRepo{}
	collectionSvc := service.NewCollectionService(repo, fetcher)
	ch := handler.NewCollectionHandler(collectionSvc, settingsRepo)
	router := setupCollectionRouter(ch)

	req := httptest.NewRequest("GET", "/collection", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Pokemon       []service.CollectionEntry `json:"pokemon"`
		CapturedCount int                       `json:"captured_count"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)

	if len(resp.Pokemon) != 0 {
		t.Errorf("expected 0 pokemon, got %d", len(resp.Pokemon))
	}
	if resp.CapturedCount != 0 {
		t.Errorf("expected captured_count 0, got %d", resp.CapturedCount)
	}
}

func TestGetPokemonDetailHandler(t *testing.T) {
	// Given: Pikachu captured with best score 92
	repo := &testutil.MockUserPokemonRepo{
		Pokemon: &model.UserPokemon{
			PokemonID:     25,
			Status:        "captured",
			TotalCaptures: 5,
			BestScore:     92,
		},
	}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: &model.Pokemon{
			ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
			DescriptionEN: "It stores electricity.",
			DescriptionJA: "でんきを ためる。",
			SpriteURL:     "https://example.com/25.png",
			FlavorTexts: []model.FlavorTextPair{
				{VersionNames: []string{"X"}, DescriptionEN: "En text", DescriptionJA: "Ja text"},
			},
		},
	}
	settingsRepo := &testutil.MockUserSettingsRepo{}
	collectionSvc := service.NewCollectionService(repo, fetcher)
	ch := handler.NewCollectionHandler(collectionSvc, settingsRepo)
	router := setupCollectionRouter(ch)

	// When: GET /collection/25
	req := httptest.NewRequest("GET", "/collection/25", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Then: returns 200 with full detail
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp service.PokemonDetailResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.NameEN != "Pikachu" {
		t.Errorf("expected Pikachu, got %s", resp.NameEN)
	}
	if resp.BestScore != 92 {
		t.Errorf("expected best score 92, got %f", resp.BestScore)
	}
	if len(resp.FlavorTexts) != 1 {
		t.Errorf("expected 1 flavor text, got %d", len(resp.FlavorTexts))
	}
}

func TestGetPokemonDetailHandler_InvalidID(t *testing.T) {
	repo := &testutil.MockUserPokemonRepo{}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", SpriteURL: "x"},
	}
	settingsRepo := &testutil.MockUserSettingsRepo{}
	collectionSvc := service.NewCollectionService(repo, fetcher)
	ch := handler.NewCollectionHandler(collectionSvc, settingsRepo)
	router := setupCollectionRouter(ch)

	req := httptest.NewRequest("GET", "/collection/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid id, got %d", w.Code)
	}
}

func TestGetCollectionHandler_RepoError(t *testing.T) {
	repo := &testutil.MockUserPokemonRepo{ErrorToReturn: fmt.Errorf("db connection failed")}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", SpriteURL: "x"},
	}
	settingsRepo := &testutil.MockUserSettingsRepo{}
	collectionSvc := service.NewCollectionService(repo, fetcher)
	ch := handler.NewCollectionHandler(collectionSvc, settingsRepo)
	router := setupCollectionRouter(ch)

	req := httptest.NewRequest("GET", "/collection", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
