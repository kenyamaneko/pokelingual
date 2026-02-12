package service_test

import (
	"context"
	"fmt"
	"math"
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
		BaseStatTotal: 320,
		Types:         []string{"electric"},
		Height:        4,
		Weight:        60,
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

func TestNewQuest_MasksNameInDescription(t *testing.T) {
	// Given: a Pokemon whose name appears in the description
	pokemon := &model.Pokemon{
		ID:            4,
		NameEN:        "Charmander",
		NameJA:        "ヒトカゲ",
		DescriptionEN: "The flame wavers when Charmander is enjoying itself.",
		DescriptionJA: "ヒトカゲの 炎が 揺れる。",
		SpriteURL:     "https://example.com/4.png",
		BaseStatTotal: 309,
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{}
	svc := setupQuestService(scorer, fetcher)

	// When: a new quest is created
	resp, err := svc.NewQuest(context.Background(), "user1")

	// Then: the Pokemon name is masked in the description
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.DescriptionEN != "The flame wavers when this Pokémon is enjoying itself." {
		t.Errorf("expected masked EN description, got %q", resp.DescriptionEN)
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
	scorer := &testutil.MockAIScorer{ScoreToReturn: 85, ReviewToReturn: "テスト レビュー"}
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
	if resp.Review != "テスト レビュー" {
		t.Errorf("expected review %q, got %q", "テスト レビュー", resp.Review)
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

func TestScoreTranslation_MasksJAName(t *testing.T) {
	// Given: a Pokemon whose JA name appears in the JA description
	pokemon := &model.Pokemon{
		ID:            25,
		NameEN:        "Pikachu",
		NameJA:        "ピカチュウ",
		DescriptionEN: "It stores electricity.",
		DescriptionJA: "たくさんの ピカチュウを 集めて 発電所を 作る。",
		SpriteURL:     "https://example.com/25.png",
		BaseStatTotal: 320,
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: pokemon}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")

	// When: scoring a translation
	resp, err := svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")

	// Then: JA name is masked in the response
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := "たくさんの この ポケモンを 集めて 発電所を 作る。"
	if resp.DescriptionJA != expected {
		t.Errorf("expected masked JA description %q, got %q", expected, resp.DescriptionJA)
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

	// Then: correct with ultra ball and language "en"
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected correct guess")
	}
	if resp.BallType != "ultra" {
		t.Errorf("expected ball_type 'ultra' for English name, got %s", resp.BallType)
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

	// Then: correct with ultra ball (case-insensitive match)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected case-insensitive match")
	}
	if resp.BallType != "ultra" {
		t.Errorf("expected ball_type 'ultra', got %s", resp.BallType)
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

	// Then: correct with great ball and language "ja"
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Correct {
		t.Error("expected correct Japanese guess")
	}
	if resp.BallType != "great" {
		t.Errorf("expected ball_type 'great' for Japanese name, got %s", resp.BallType)
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
	if resp.BallType != "ultra" {
		t.Errorf("expected ball_type 'ultra' for fuzzy EN match, got %s", resp.BallType)
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
		BaseStatTotal: 600,
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

func TestAttemptCapture_HighScoreUltraBall(t *testing.T) {
	// Given: score=100 and English name guessed correctly (ultra ball, 2.0x)
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
	if resp.BallType != "ultra" {
		t.Errorf("expected ball_type 'ultra', got %s", resp.BallType)
	}
	if resp.BaseStatTotal != 320 {
		t.Errorf("expected base_stat_total 320, got %d", resp.BaseStatTotal)
	}
}

func TestAttemptCapture_PokeBallLowerProbability(t *testing.T) {
	// Given: score=80, name guess skipped (poke ball, 1.0x)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")

	// When: attempting capture without guessing (skip → poke ball)
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability uses sigmoid formula with ball multiplier 1.0
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := service.CalculateCaptureRate(80, 320, 1.0)
	if math.Abs(resp.Probability-expected) > 0.001 {
		t.Errorf("expected probability ~%.4f, got %.4f", expected, resp.Probability)
	}
}

func TestAttemptCapture_GreatBall(t *testing.T) {
	// Given: score=80, Japanese name guessed correctly (great ball, 1.5x)
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	scorer := &testutil.MockAIScorer{ScoreToReturn: 80}
	svc := setupQuestService(scorer, fetcher)
	_, _ = svc.NewQuest(context.Background(), "user1")
	_, _ = svc.ScoreTranslation(context.Background(), "user1", "翻訳テスト")
	_, _ = svc.GuessName(context.Background(), "user1", "ピカチュウ")

	// When: attempting capture
	resp, err := svc.AttemptCapture(context.Background(), "user1")

	// Then: probability uses sigmoid formula with great ball multiplier 1.5
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := service.CalculateCaptureRate(80, 320, 1.5)
	if math.Abs(resp.Probability-expected) > 0.001 {
		t.Errorf("expected probability ~%.4f, got %.4f", expected, resp.Probability)
	}
	if resp.BallType != "great" {
		t.Errorf("expected ball_type 'great', got %s", resp.BallType)
	}
}

func TestAttemptCapture_AllWrongPokeBall(t *testing.T) {
	// Given: score=80, 3 wrong guesses (poke ball, 1.0x)
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

	// Then: probability uses sigmoid formula with poke ball (1.0x)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := service.CalculateCaptureRate(80, 320, 1.0)
	if math.Abs(resp.Probability-expected) > 0.001 {
		t.Errorf("expected probability ~%.4f, got %.4f", expected, resp.Probability)
	}
	if resp.BallType != "poke" {
		t.Errorf("expected ball_type 'poke', got %s", resp.BallType)
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

func TestCalculateCaptureRate(t *testing.T) {
	tests := []struct {
		name           string
		score          float64
		bst            int
		ballMultiplier float64
		wantMin        float64
		wantMax        float64
	}{
		{"weak pokemon high score", 90, 300, 1.0, 0.95, 1.0},
		{"strong pokemon high score", 90, 600, 1.0, 0.25, 0.40},
		{"weak pokemon low score", 30, 300, 1.0, 0.75, 0.90},
		{"strong pokemon low score", 30, 600, 1.0, 0.01, 0.05},
		{"ultra ball triples rate", 50, 400, 3.0, 1.0, 1.0},
		{"great ball doubles rate", 50, 400, 2.0, 1.0, 1.0},
		{"capped at 1.0", 100, 200, 3.0, 1.0, 1.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rate := service.CalculateCaptureRate(tt.score, tt.bst, tt.ballMultiplier)
			if rate < tt.wantMin || rate > tt.wantMax {
				t.Errorf("CalculateCaptureRate(%.0f, %d, %.1f) = %.4f, want [%.4f, %.4f]",
					tt.score, tt.bst, tt.ballMultiplier, rate, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestMaskPokemonNameEN(t *testing.T) {
	tests := []struct {
		name string
		text string
		poke string
		want string
	}{
		{
			"singular at sentence start",
			"Pikachu stores electricity in its cheeks.",
			"Pikachu",
			"This Pokémon stores electricity in its cheeks.",
		},
		{
			"singular mid-sentence",
			"The flame wavers when Charmander is enjoying itself.",
			"Charmander",
			"The flame wavers when this Pokémon is enjoying itself.",
		},
		{
			"plural with several",
			"When several Pikachu gather, lightning storms occur.",
			"Pikachu",
			"When several of these Pokémon gather, lightning storms occur.",
		},
		{
			"plural with many",
			"A plan to gather many Pikachu and generate electricity.",
			"Pikachu",
			"A plan to gather many of these Pokémon and generate electricity.",
		},
		{
			"no match",
			"It stores electricity in its cheeks.",
			"Pikachu",
			"It stores electricity in its cheeks.",
		},
		{
			"empty name",
			"Some text here.",
			"",
			"Some text here.",
		},
		{
			"case insensitive match",
			"A wild pikachu appeared!",
			"Pikachu",
			"A wild this Pokémon appeared!",
		},
		{
			"after period (sentence start)",
			"It is cute. Pikachu loves ketchup.",
			"Pikachu",
			"It is cute. This Pokémon loves ketchup.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := service.MaskPokemonNameEN(tt.text, tt.poke)
			if got != tt.want {
				t.Errorf("MaskPokemonNameEN(%q, %q)\n  got  %q\n  want %q", tt.text, tt.poke, got, tt.want)
			}
		})
	}
}

func TestMaskPokemonNameJA(t *testing.T) {
	tests := []struct {
		name string
		text string
		poke string
		want string
	}{
		{
			"simple replacement",
			"ピカチュウが 電気を ためている。",
			"ピカチュウ",
			"この ポケモンが 電気を ためている。",
		},
		{
			"no match",
			"何匹か 集まると 激しい 雷が 落ちる。",
			"ピカチュウ",
			"何匹か 集まると 激しい 雷が 落ちる。",
		},
		{
			"empty name",
			"何かのテキスト。",
			"",
			"何かのテキスト。",
		},
		{
			"multiple occurrences",
			"ピカチュウは ピカチュウらしい。",
			"ピカチュウ",
			"この ポケモンは この ポケモンらしい。",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := service.MaskPokemonNameJA(tt.text, tt.poke)
			if got != tt.want {
				t.Errorf("MaskPokemonNameJA(%q, %q)\n  got  %q\n  want %q", tt.text, tt.poke, got, tt.want)
			}
		})
	}
}
