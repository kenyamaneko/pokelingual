package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kenyamamoto/pokelingual/backend/internal/handler"
	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
	"github.com/kenyamamoto/pokelingual/backend/internal/testutil"
)

// TestQuestFlow_FullCapture tests the complete quest flow: new → score → guess → capture.
func TestQuestFlow_FullCapture(t *testing.T) {
	// Given: mocks for a complete quest flow
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "It stores electricity in its cheeks.",
		DescriptionJA: "ほっぺの でんきぶくろに でんきを ためている。",
		SpriteURL:     "https://example.com/25.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 85}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// Step 1: Start new quest
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("new quest: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var newResp service.QuestNewResponse
	json.Unmarshal(w.Body.Bytes(), &newResp)
	if newResp.PokemonID != 25 {
		t.Errorf("expected pokemon_id 25, got %d", newResp.PokemonID)
	}
	if newResp.DescriptionEN == "" {
		t.Error("expected non-empty description_en")
	}

	// Step 2: Submit translation
	body, _ := json.Marshal(map[string]string{"translation": "ほっぺに電気をためている"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("score: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var scoreResp service.ScoreResponse
	json.Unmarshal(w.Body.Bytes(), &scoreResp)
	if scoreResp.Score != 85 {
		t.Errorf("expected score 85, got %f", scoreResp.Score)
	}
	if scoreResp.DescriptionJA == "" {
		t.Error("expected non-empty description_ja")
	}

	// Step 3: Guess name correctly in English
	body, _ = json.Marshal(map[string]string{"guess": "Pikachu"})
	req = httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("guess: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var guessResp service.GuessResponse
	json.Unmarshal(w.Body.Bytes(), &guessResp)
	if !guessResp.Correct {
		t.Error("expected correct guess")
	}
	if guessResp.Language != "en" {
		t.Errorf("expected language en, got %s", guessResp.Language)
	}
	if guessResp.Multiplier != 1.5 {
		t.Errorf("expected multiplier 1.5, got %f", guessResp.Multiplier)
	}

	// Step 4: Capture
	req = httptest.NewRequest("POST", "/quest/capture", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("capture: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var captureResp service.CaptureResponse
	json.Unmarshal(w.Body.Bytes(), &captureResp)
	if captureResp.PokemonID != 25 {
		t.Errorf("expected pokemon_id 25, got %d", captureResp.PokemonID)
	}
	if captureResp.NameEN != "Pikachu" {
		t.Errorf("expected name Pikachu, got %s", captureResp.NameEN)
	}
	if captureResp.SpriteURL == "" {
		t.Error("expected non-empty sprite_url")
	}

	// Verify persistence
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
	if call.Score != 85 {
		t.Errorf("expected score 85, got %f", call.Score)
	}
}

// TestQuestFlow_SkipGuessAndCapture tests flow: new → score → skip guess → capture.
func TestQuestFlow_SkipGuessAndCapture(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ",
		DescriptionEN: "A strange seed was planted on its back.",
		DescriptionJA: "せなかに ふしぎな タネが うえてある。",
		SpriteURL:     "https://example.com/1.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// Step 1: New quest
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("new quest: expected 200, got %d", w.Code)
	}

	// Step 2: Score
	body, _ := json.Marshal(map[string]string{"translation": "背中に種がある"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("score: expected 200, got %d", w.Code)
	}

	// Step 3: Skip guess → go directly to capture (multiplier defaults to 0.5)
	req = httptest.NewRequest("POST", "/quest/capture", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("capture: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var captureResp service.CaptureResponse
	json.Unmarshal(w.Body.Bytes(), &captureResp)

	// Skip multiplier = 0.5, so probability = (80/100) * 0.5 = 0.40
	expectedProb := 0.40
	if captureResp.Probability != expectedProb {
		t.Errorf("expected probability %f, got %f", expectedProb, captureResp.Probability)
	}

	if len(repo.UpsertCalls) != 1 {
		t.Fatalf("expected 1 upsert call, got %d", len(repo.UpsertCalls))
	}
}

// TestQuestFlow_JapaneseGuessCapture tests name guessing in Japanese.
func TestQuestFlow_JapaneseGuessCapture(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 4, NameEN: "Charmander", NameJA: "ヒトカゲ",
		DescriptionEN: "The flame on its tail indicates its life force.",
		DescriptionJA: "しっぽの ほのおは いのちの あかし。",
		SpriteURL:     "https://example.com/4.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 90}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// New → Score → Japanese guess → Capture
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body, _ := json.Marshal(map[string]string{"translation": "しっぽの炎は命のあかし"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Guess in Japanese
	body, _ = json.Marshal(map[string]string{"guess": "ヒトカゲ"})
	req = httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var guessResp service.GuessResponse
	json.Unmarshal(w.Body.Bytes(), &guessResp)
	if !guessResp.Correct {
		t.Error("expected correct Japanese guess")
	}
	if guessResp.Language != "ja" {
		t.Errorf("expected language ja, got %s", guessResp.Language)
	}
	if guessResp.Multiplier != 1.0 {
		t.Errorf("expected multiplier 1.0 for JA guess, got %f", guessResp.Multiplier)
	}

	// Capture: prob = (90/100) * 1.0 = 0.90
	req = httptest.NewRequest("POST", "/quest/capture", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var captureResp service.CaptureResponse
	json.Unmarshal(w.Body.Bytes(), &captureResp)
	if captureResp.Probability != 0.90 {
		t.Errorf("expected probability 0.90, got %f", captureResp.Probability)
	}
}

// TestQuestFlow_WrongGuessesReduceProbability tests wrong guesses apply penalty.
func TestQuestFlow_WrongGuessesReduceProbability(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 7, NameEN: "Squirtle", NameJA: "ゼニガメ",
		DescriptionEN: "It shelters itself in its shell.",
		DescriptionJA: "こうらの なかに かくれる。",
		SpriteURL:     "https://example.com/7.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// New → Score
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body, _ := json.Marshal(map[string]string{"translation": "甲羅に隠れる"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// 3 wrong guesses → all wrong
	wrongNames := []string{"Pikachu", "Charmander", "Bulbasaur"}
	for _, name := range wrongNames {
		body, _ = json.Marshal(map[string]string{"guess": name})
		req = httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}

	// After 3 wrong guesses: multiplier=0.5, wrongGuesses=3, penalty=0.85
	// probability = (80/100) * 0.5 * 0.85 = 0.34
	req = httptest.NewRequest("POST", "/quest/capture", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var captureResp service.CaptureResponse
	json.Unmarshal(w.Body.Bytes(), &captureResp)

	expectedProb := 0.80 * 0.5 * 0.85
	if captureResp.Probability != expectedProb {
		t.Errorf("expected probability %f, got %f", expectedProb, captureResp.Probability)
	}
}

// TestQuestFlow_FuzzyMatchEN tests fuzzy English name matching.
func TestQuestFlow_FuzzyMatchEN(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 6, NameEN: "Charizard", NameJA: "リザードン",
		DescriptionEN: "It breathes fire.",
		DescriptionJA: "ひを ふく。",
		SpriteURL:     "https://example.com/6.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 70}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// New → Score
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body, _ := json.Marshal(map[string]string{"translation": "火を吹く"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Fuzzy guess: "Charizrd" (missing 'a') → Levenshtein distance 1
	body, _ = json.Marshal(map[string]string{"guess": "Charizrd"})
	req = httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var guessResp service.GuessResponse
	json.Unmarshal(w.Body.Bytes(), &guessResp)
	if !guessResp.Correct {
		t.Error("expected fuzzy match to be correct")
	}
	if !guessResp.Fuzzy {
		t.Error("expected fuzzy flag to be true")
	}
	if guessResp.Multiplier != 1.5 {
		t.Errorf("expected multiplier 1.5, got %f", guessResp.Multiplier)
	}
}

// TestQuestFlow_GuessNameRevealAfterMaxAttempts tests name reveal on 3 wrong guesses.
func TestQuestFlow_GuessNameRevealAfterMaxAttempts(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "It stores electricity.",
		DescriptionJA: "でんきを ためる。",
		SpriteURL:     "https://example.com/25.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 50}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// New → Score
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body, _ := json.Marshal(map[string]string{"translation": "電気をためる"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// 3 wrong guesses
	for i, name := range []string{"Wrong1", "Wrong2", "Wrong3"} {
		body, _ = json.Marshal(map[string]string{"guess": name})
		req = httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()
		router.ServeHTTP(w, req)

		var resp service.GuessResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		if i < 2 {
			if resp.AttemptsRemaining != 2-i {
				t.Errorf("guess %d: expected %d remaining, got %d", i+1, 2-i, resp.AttemptsRemaining)
			}
		} else {
			// 3rd wrong guess reveals the name
			if resp.AttemptsRemaining != 0 {
				t.Errorf("expected 0 remaining, got %d", resp.AttemptsRemaining)
			}
			if resp.RevealNameEN != "Pikachu" {
				t.Errorf("expected reveal Pikachu, got %s", resp.RevealNameEN)
			}
			if resp.RevealNameJA != "ピカチュウ" {
				t.Errorf("expected reveal ピカチュウ, got %s", resp.RevealNameJA)
			}
		}
	}
}

// TestQuestFlow_SessionIsolation verifies different users have separate sessions.
func TestQuestFlow_SessionIsolation(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "Test.", DescriptionJA: "テスト。",
		SpriteURL: "https://example.com/25.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 70}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)

	// Create router for user-a
	routerA := setupTestRouterWithUID(h, "user-a")
	// Create router for user-b
	routerB := setupTestRouterWithUID(h, "user-b")

	// User A starts a quest
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	routerA.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("user-a new quest: expected 200, got %d", w.Code)
	}

	// User B has no session → score should fail with 404
	body, _ := json.Marshal(map[string]string{"translation": "テスト"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	routerB.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("user-b score: expected 404, got %d", w.Code)
	}

	// User A can still score (session exists)
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	routerA.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("user-a score: expected 200, got %d", w.Code)
	}
}

// TestQuestFlow_SessionDeletedAfterCapture verifies session cleanup.
func TestQuestFlow_SessionDeletedAfterCapture(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "Test.", DescriptionJA: "テスト。",
		SpriteURL: "https://example.com/25.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// Complete flow: new → score → capture
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	body, _ := json.Marshal(map[string]string{"translation": "テスト"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	req = httptest.NewRequest("POST", "/quest/capture", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("capture: expected 200, got %d", w.Code)
	}

	// After capture, session is deleted → score should fail
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("post-capture score: expected 404, got %d", w.Code)
	}
}

// TestGuessNameHandler_MissingBody tests validation on empty guess body.
func TestGuessNameHandler_MissingBody(t *testing.T) {
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x"}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// POST /quest/guess-name with empty body
	req := httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing guess, got %d", w.Code)
	}
}

// TestGuessNameHandler_NoSession tests guess without active session.
func TestGuessNameHandler_NoSession(t *testing.T) {
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: &model.Pokemon{ID: 1, NameEN: "Bulbasaur", NameJA: "フシギダネ", DescriptionEN: "test", SpriteURL: "x"}}
	scorer := &testutil.MockAIScorer{}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	body, _ := json.Marshal(map[string]string{"guess": "Pikachu"})
	req := httptest.NewRequest("POST", "/quest/guess-name", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404 for no session, got %d", w.Code)
	}
}

// TestScoreTranslationHandler_ExternalServiceError tests Gemini failure.
func TestScoreTranslationHandler_ExternalServiceError(t *testing.T) {
	pokemon := &model.Pokemon{
		ID: 25, NameEN: "Pikachu", NameJA: "ピカチュウ",
		DescriptionEN: "Test.", DescriptionJA: "テスト。",
		SpriteURL: "https://example.com/25.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ErrorToReturn: fmt.Errorf("gemini unavailable")}
	repo := &testutil.MockUserPokemonRepo{}

	questSvc := service.NewQuestService(fetcher, scorer, nil)
	h := handler.NewQuestHandler(questSvc, repo)
	router := setupTestRouter(h)

	// Start quest
	req := httptest.NewRequest("GET", "/quest/new", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Score with failing AI service
	body, _ := json.Marshal(map[string]string{"translation": "テスト"})
	req = httptest.NewRequest("POST", "/quest/score", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadGateway {
		t.Errorf("expected 502, got %d: %s", w.Code, w.Body.String())
	}

	// Verify error message doesn't leak internals
	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "external service unavailable" {
		t.Errorf("expected generic error, got %q", resp["error"])
	}
}
