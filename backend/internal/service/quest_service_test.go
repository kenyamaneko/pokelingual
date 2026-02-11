package service_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
	"github.com/kenyamamoto/pokelingual/backend/internal/testutil"
)

func newTestPokemon() *model.Pokemon {
	return &model.Pokemon{
		ID:            25,
		NameEN:        "Pikachu",
		NameJA:        "ピカチュウ",
		DescriptionEN: "When several of these Pokemon gather, their electricity can build and cause lightning storms.",
		DescriptionJA: "何匹か 集まると そこに 激しい 雷が 落ちることがある。",
		SpriteURL:     "https://example.com/pikachu.png",
	}
}

func setupQuestService(scorer *testutil.MockAIScorer, fetcher *testutil.MockPokemonFetcher) *service.QuestService {
	return service.NewQuestService(fetcher, scorer, nil)
}

func TestNewQuest(t *testing.T) {
	// Given: a fetcher that returns Pikachu
	pokemon := newTestPokemon()
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)

	// When: a new quest is created
	resp, err := svc.NewQuest(context.Background(), "user1")

	// Then: returns Pikachu's data
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.PokemonID != 25 {
		t.Errorf("expected pokemon_id 25, got %d", resp.PokemonID)
	}
	if resp.DescriptionEN != pokemon.DescriptionEN {
		t.Errorf("expected description to match")
	}
}

func TestNewQuest_FetcherError(t *testing.T) {
	// Given: a fetcher that returns an error
	fetcher := &testutil.MockPokemonFetcher{ErrorToReturn: fmt.Errorf("api down")}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)

	// When: a new quest is created
	_, err := svc.NewQuest(context.Background(), "user1")

	// Then: returns an error
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestScoreTranslation(t *testing.T) {
	// Given: an active quest session and a scorer returning 85
	pokemon := newTestPokemon()
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 85}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: scoring a translation
	resp, err := svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")

	// Then: returns score 85, and scorer is called with the correct text
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Score != 85 {
		t.Errorf("expected score 85, got %f", resp.Score)
	}
	if len(scorer.CalledWith) != 1 {
		t.Fatalf("expected scorer called once, got %d", len(scorer.CalledWith))
	}
	if scorer.CalledWith[0].EnglishText != pokemon.DescriptionEN {
		t.Error("scorer called with wrong english text")
	}
	if resp.DescriptionJA != pokemon.DescriptionJA {
		t.Errorf("expected description_ja %q, got %q", pokemon.DescriptionJA, resp.DescriptionJA)
	}
}

func TestScoreTranslation_NoSession(t *testing.T) {
	// Given: no quest session exists for the user
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)

	// When: scoring is attempted without an active session
	_, err := svc.ScoreTranslation(context.Background(), "no-session-user", "test")

	// Then: returns an error
	if err == nil {
		t.Fatal("expected error for missing session")
	}
}

func TestGuessName_ExactEnglish(t *testing.T) {
	// Given: an active quest session with Pikachu
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: guessing the exact English name "Pikachu"
	resp, err := svc.GuessName(context.Background(), "user1", "Pikachu")

	// Then: correct with 1.5x multiplier and language "en"
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected correct guess")
	}
	if resp.Multiplier != 1.5 {
		t.Errorf("expected 1.5 multiplier for English name, got %f", resp.Multiplier)
	}
	if resp.Language != "en" {
		t.Errorf("expected language 'en', got %s", resp.Language)
	}
}

func TestGuessName_CaseInsensitive(t *testing.T) {
	// Given: an active quest session with Pikachu
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: guessing "pikachu" (lowercase)
	resp, err := svc.GuessName(context.Background(), "user1", "pikachu")

	// Then: correct with 1.5x multiplier (case-insensitive match)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected case-insensitive match")
	}
	if resp.Multiplier != 1.5 {
		t.Errorf("expected 1.5 multiplier, got %f", resp.Multiplier)
	}
}

func TestGuessName_Japanese(t *testing.T) {
	// Given: an active quest session with Pikachu
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: guessing the Japanese name "ピカチュウ"
	resp, err := svc.GuessName(context.Background(), "user1", "ピカチュウ")

	// Then: correct with 1.0x multiplier (no bonus) and language "ja"
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected correct Japanese guess")
	}
	if resp.Multiplier != 1.0 {
		t.Errorf("expected 1.0 multiplier for Japanese name, got %f", resp.Multiplier)
	}
	if resp.Language != "ja" {
		t.Errorf("expected language 'ja', got %s", resp.Language)
	}
}

func TestGuessName_FuzzyMatch(t *testing.T) {
	// Given: an active quest session with Pikachu (7 chars, > 3 threshold)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: guessing "Pikacbu" (Levenshtein distance 1 from "Pikachu")
	resp, err := svc.GuessName(context.Background(), "user1", "Pikacbu")

	// Then: correct via fuzzy match with Fuzzy flag set
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected fuzzy match to succeed (Levenshtein distance 1)")
	}
	if !resp.Fuzzy {
		t.Error("expected Fuzzy flag to be true")
	}
}

func TestGuessName_ThreeWrongAttempts(t *testing.T) {
	// Given: an active quest session with Pikachu
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: guessing wrong 3 times
	for i := 0; i < 2; i++ {
		resp, _ := svc.GuessName(context.Background(), "user1", "WrongName")
		if resp.Correct {
			t.Fatalf("attempt %d should be wrong", i+1)
		}
		if resp.AttemptsRemaining != 2-i {
			t.Errorf("attempt %d: expected %d remaining, got %d", i+1, 2-i, resp.AttemptsRemaining)
		}
	}

	resp, _ := svc.GuessName(context.Background(), "user1", "StillWrong")

	// Then: 3rd attempt reveals the correct names
	if resp.Correct {
		t.Error("third attempt should be wrong")
	}
	if resp.AttemptsRemaining != 0 {
		t.Errorf("expected 0 remaining, got %d", resp.AttemptsRemaining)
	}
	if resp.RevealNameEN != "Pikachu" {
		t.Errorf("expected reveal name Pikachu, got %s", resp.RevealNameEN)
	}
	if resp.RevealNameJA != "ピカチュウ" {
		t.Errorf("expected reveal name ピカチュウ, got %s", resp.RevealNameJA)
	}
}

func TestGuessName_ShortNameNoFuzzy(t *testing.T) {
	// Given: an active quest session with Mew (3 chars, ≤ threshold)
	shortPokemon := &model.Pokemon{
		ID:            151,
		NameEN:        "Mew",
		NameJA:        "ミュウ",
		DescriptionEN: "So rare that it is still said to be a mirage.",
		SpriteURL:     "https://example.com/mew.png",
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: shortPokemon}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: guessing "Met" (Levenshtein distance 1 from "Mew")
	resp, _ := svc.GuessName(context.Background(), "user1", "Met")

	// Then: incorrect — fuzzy match is disabled for names ≤ 3 chars
	if resp.Correct {
		t.Error("fuzzy match should not apply to names with 3 or fewer chars")
	}
}

func TestAttemptCapture_HighScore(t *testing.T) {
	// Given: score=100 and English name guessed correctly (1.5x multiplier)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 100}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "完璧な翻訳")
	_, _ = svc.GuessName(context.Background(), "user1", "Pikachu")

	// When: attempting capture
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability capped at 1.0, always captured
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Probability != 1.0 {
		t.Errorf("expected probability 1.0, got %f", resp.Probability)
	}
	if !resp.Captured {
		t.Error("expected capture with 100% probability")
	}
	if resp.NameEN != "Pikachu" {
		t.Errorf("expected name Pikachu, got %s", resp.NameEN)
	}
}

func TestAttemptCapture_ZeroScore(t *testing.T) {
	// Given: score=0 (no name guess, default multiplier 0.5)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 0}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "でたらめ")

	// When: attempting capture
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability is 0, never captured
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Probability != 0 {
		t.Errorf("expected probability 0, got %f", resp.Probability)
	}
	if resp.Captured {
		t.Error("should not capture with 0% probability")
	}
}

func TestAttemptCapture_WrongGuessPenalty(t *testing.T) {
	// Given: score=80, 2 wrong guesses then Japanese name correct (multiplier=1.0)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")
	_, _ = svc.GuessName(context.Background(), "user1", "WrongName1")
	_, _ = svc.GuessName(context.Background(), "user1", "WrongName2")
	_, _ = svc.GuessName(context.Background(), "user1", "ピカチュウ")

	// When: attempting capture
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability is reduced by 10% (2 wrong * 5% each)
	// base = 0.8 * 1.0 * 0.90 = 0.72
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := 0.72
	if resp.Probability < expected-0.001 || resp.Probability > expected+0.001 {
		t.Errorf("expected probability ~%.2f, got %f", expected, resp.Probability)
	}
}

func TestAttemptCapture_SkipHalfMultiplier(t *testing.T) {
	// Given: score=80, name guess skipped (multiplier=0.5, 0 wrong guesses)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")

	// When: attempting capture without guessing (skip)
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability is 0.8 * 0.5 * 1.0 = 0.40
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := 0.40
	if resp.Probability < expected-0.001 || resp.Probability > expected+0.001 {
		t.Errorf("expected probability ~%.2f, got %f", expected, resp.Probability)
	}
}

func TestAttemptCapture_AllWrongHalfMultiplier(t *testing.T) {
	// Given: score=80, 3 wrong guesses (multiplier=0.5, 3 wrong)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")
	_, _ = svc.GuessName(context.Background(), "user1", "Wrong1")
	_, _ = svc.GuessName(context.Background(), "user1", "Wrong2")
	_, _ = svc.GuessName(context.Background(), "user1", "Wrong3")

	// When: attempting capture
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability is 0.8 * 0.5 * 0.85 = 0.34
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := 0.34
	if resp.Probability < expected-0.001 || resp.Probability > expected+0.001 {
		t.Errorf("expected probability ~%.2f, got %f", expected, resp.Probability)
	}
}

func TestAttemptCapture_SessionDeletedAfter(t *testing.T) {
	// Given: a capture has already been attempted
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 50}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "test")
	_, _ = svc.AttemptCapture(context.Background(), "user1")

	// When: attempting capture again on the same session
	_, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: returns an error (session was deleted after first capture)
	if err == nil {
		t.Error("expected error for deleted session")
	}
}
