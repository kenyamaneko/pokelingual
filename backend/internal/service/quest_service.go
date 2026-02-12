package service

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"strings"
	"sync"
	"unicode"

	"github.com/agnivade/levenshtein"
	"github.com/kenyamamoto/pokelingual/backend/internal/apperror"
	"github.com/kenyamamoto/pokelingual/backend/internal/domain"
	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// QuestService manages the quest flow: generating quests, scoring translations,
// evaluating name guesses, and determining capture results.
type QuestService struct {
	pokemonFetcher domain.PokemonFetcher
	aiScorer       domain.AIScorer
	settingsRepo   domain.UserSettingsRepository
	sessions       sync.Map
}

// QuestNewResponse is the API response for starting a new quest.
type QuestNewResponse struct {
	PokemonID     int    `json:"pokemon_id"`
	DescriptionEN string `json:"description_en"`
}

// ScoreResponse is the API response for a translation scoring.
type ScoreResponse struct {
	Score         float64 `json:"score"`
	Review        string  `json:"review"`
	DescriptionJA string  `json:"description_ja"`
}

// GuessResponse is the API response for a Pokemon name guess attempt.
type GuessResponse struct {
	Correct           bool   `json:"correct"`
	BallType          string `json:"ball_type,omitempty"`
	Language          string `json:"language,omitempty"`
	Fuzzy             bool   `json:"fuzzy,omitempty"`
	AttemptsRemaining int    `json:"attempts_remaining"`
	RevealNameEN      string `json:"reveal_name_en,omitempty"`
	RevealNameJA      string `json:"reveal_name_ja,omitempty"`
}

// CaptureResponse is the API response for a capture attempt.
type CaptureResponse struct {
	Captured      bool     `json:"captured"`
	Probability   float64  `json:"probability"`
	PokemonID     int      `json:"pokemon_id"`
	NameEN        string   `json:"name_en"`
	NameJA        string   `json:"name_ja"`
	SpriteURL     string   `json:"sprite_url"`
	Score         float64  `json:"score"`
	DescriptionEN string   `json:"description_en"`
	DescriptionJA string   `json:"description_ja"`
	BaseStatTotal int      `json:"base_stat_total"`
	BallType      string   `json:"ball_type"`
	Types         []string `json:"types"`
	Height        int      `json:"height"`
	Weight        int      `json:"weight"`
}

// NewQuestService creates a new QuestService with the given dependencies.
func NewQuestService(pokemonFetcher domain.PokemonFetcher, aiScorer domain.AIScorer, settingsRepo domain.UserSettingsRepository) *QuestService {
	return &QuestService{
		pokemonFetcher: pokemonFetcher,
		aiScorer:       aiScorer,
		settingsRepo:   settingsRepo,
	}
}

// NewQuest starts a new quest by fetching a random Pokemon,
// retrying if the Pokemon is in the user's excluded list.
func (s *QuestService) NewQuest(ctx context.Context, uid string) (*QuestNewResponse, error) {
	// Build excluded set: use user settings if configured, otherwise defaults
	excluded := map[int]bool{}
	if s.settingsRepo != nil {
		settings, err := s.settingsRepo.GetSettings(ctx, uid)
		if err == nil && settings != nil {
			ids := settings.ExcludedPokemonIDs
			if ids == nil {
				ids = DefaultExcludedPokemonIDs
			}
			for _, id := range ids {
				excluded[id] = true
			}
		}
	}

	var pokemon *model.Pokemon
	var err error
	for i := 0; i < 10; i++ {
		pokemon, err = s.pokemonFetcher.GetRandomPokemon(ctx)
		if err != nil {
			return nil, apperror.NewExternalServiceError("PokeAPI", err)
		}
		if !excluded[pokemon.ID] {
			break
		}
	}

	// Pick a random flavor text pair so different versions appear across quests
	descEN := pokemon.DescriptionEN
	descJA := pokemon.DescriptionJA
	if len(pokemon.FlavorTexts) > 0 {
		pair := pokemon.FlavorTexts[rand.Intn(len(pokemon.FlavorTexts))]
		descEN = pair.DescriptionEN
		descJA = pair.DescriptionJA
	}

	session := &model.QuestSession{
		PokemonID:     pokemon.ID,
		DescriptionEN: descEN,
		DescriptionJA: descJA,
		NameEN:        pokemon.NameEN,
		NameJA:        pokemon.NameJA,
		SpriteURL:     pokemon.SpriteURL,
		BaseStatTotal: pokemon.BaseStatTotal,
		Types:         pokemon.Types,
		Height:        pokemon.Height,
		Weight:        pokemon.Weight,
	}
	s.sessions.Store(uid, session)

	return &QuestNewResponse{
		PokemonID:     pokemon.ID,
		DescriptionEN: MaskPokemonNameEN(descEN, pokemon.NameEN),
	}, nil
}

// ScoreTranslation scores the user's Japanese translation using the AI scorer.
func (s *QuestService) ScoreTranslation(ctx context.Context, uid string, translation string) (*ScoreResponse, error) {
	session, err := s.getSession(uid)
	if err != nil {
		return nil, err
	}

	result, err := s.aiScorer.ScoreTranslation(ctx, session.DescriptionEN, translation)
	if err != nil {
		return nil, apperror.NewExternalServiceError("Gemini", err)
	}

	session.Score = result.Score

	return &ScoreResponse{
		Score:         result.Score,
		Review:        result.Review,
		DescriptionJA: MaskPokemonNameJA(session.DescriptionJA, session.NameJA),
	}, nil
}

// GuessName evaluates a Pokemon name guess with exact, fuzzy, and Japanese matching.
// The result determines ball type: EN correct → ultra, JA correct → great, fail → poke.
func (s *QuestService) GuessName(ctx context.Context, uid string, guess string) (*GuessResponse, error) {
	session, err := s.getSession(uid)
	if err != nil {
		return nil, err
	}

	if session.NameGuessed {
		return &GuessResponse{
			Correct:           true,
			BallType:          session.BallType,
			AttemptsRemaining: 0,
		}, nil
	}

	session.GuessAttempts++

	guessNorm := strings.ToLower(strings.TrimSpace(guess))
	nameENNorm := strings.ToLower(session.NameEN)
	guessJA := strings.TrimSpace(guess)

	if guessNorm == nameENNorm {
		session.BallType = "ultra"
		session.NameGuessed = true
		return &GuessResponse{
			Correct:           true,
			BallType:          "ultra",
			Language:          "en",
			AttemptsRemaining: 3 - session.GuessAttempts,
		}, nil
	}

	if guessJA == session.NameJA {
		session.BallType = "great"
		session.NameGuessed = true
		return &GuessResponse{
			Correct:           true,
			BallType:          "great",
			Language:          "ja",
			AttemptsRemaining: 3 - session.GuessAttempts,
		}, nil
	}

	if len(nameENNorm) > 3 {
		dist := levenshtein.ComputeDistance(guessNorm, nameENNorm)
		if dist <= 2 {
			session.BallType = "ultra"
			session.NameGuessed = true
			return &GuessResponse{
				Correct:           true,
				BallType:          "ultra",
				Language:          "en",
				Fuzzy:             true,
				AttemptsRemaining: 3 - session.GuessAttempts,
			}, nil
		}
	}

	remaining := 3 - session.GuessAttempts
	if remaining <= 0 {
		session.BallType = "poke"
		session.NameGuessed = true
		return &GuessResponse{
			Correct:           false,
			AttemptsRemaining: 0,
			RevealNameEN:      session.NameEN,
			RevealNameJA:      session.NameJA,
		}, nil
	}

	return &GuessResponse{
		Correct:           false,
		AttemptsRemaining: remaining,
	}, nil
}

// AttemptCapture calculates capture probability using BST-based sigmoid formula
// and determines if the Pokemon is caught.
func (s *QuestService) AttemptCapture(ctx context.Context, uid string) (*CaptureResponse, error) {
	session, err := s.getSession(uid)
	if err != nil {
		return nil, err
	}

	ballMultiplier := 1.0
	switch session.BallType {
	case "great":
		ballMultiplier = 2.0
	case "ultra":
		ballMultiplier = 3.0
	}

	probability := CalculateCaptureRate(session.Score, session.BaseStatTotal, ballMultiplier)

	captured := rand.Float64() < probability

	s.sessions.Delete(uid)

	return &CaptureResponse{
		Captured:      captured,
		Probability:   probability,
		PokemonID:     session.PokemonID,
		NameEN:        session.NameEN,
		NameJA:        session.NameJA,
		SpriteURL:     session.SpriteURL,
		Score:         session.Score,
		DescriptionEN: session.DescriptionEN,
		DescriptionJA: session.DescriptionJA,
		BaseStatTotal: session.BaseStatTotal,
		BallType:      session.BallType,
		Types:         session.Types,
		Height:        session.Height,
		Weight:        session.Weight,
	}, nil
}

func (s *QuestService) getSession(uid string) (*model.QuestSession, error) {
	val, ok := s.sessions.Load(uid)
	if !ok {
		return nil, fmt.Errorf("no active quest session: %w", apperror.ErrNotFound)
	}
	return val.(*model.QuestSession), nil
}

// CalculateCaptureRate computes capture probability using a sigmoid function
// that accounts for translation score and Pokemon base stat total.
// Returns a probability in [0.0, 1.0].
func CalculateCaptureRate(score float64, bst int, ballMultiplier float64) float64 {
	x := float64(bst) / 100.0
	s := score / 100.0

	logit := 3.12 - 0.34*x - 0.17*x*x + 12.78*s - 4.83*x*s + 0.58*x*x*s
	rate := 1.0 / (1.0 + math.Exp(-logit))

	rate *= ballMultiplier
	if rate > 1.0 {
		rate = 1.0
	}
	return rate
}

// pluralHints are words that indicate the Pokemon name is used in a plural context.
var pluralHints = map[string]bool{
	"several": true, "many": true, "multiple": true,
	"few": true, "these": true, "those": true, "numerous": true,
}

// MaskPokemonNameEN replaces a Pokemon's English name in text with context-aware pronouns.
// Uses "this Pokémon" for singular and "these Pokémon" for plural contexts.
// Capitalizes at sentence boundaries.
func MaskPokemonNameEN(text, name string) string {
	if name == "" {
		return text
	}

	lower := strings.ToLower(text)
	lowerName := strings.ToLower(name)
	var result strings.Builder
	i := 0

	for i < len(lower) {
		idx := strings.Index(lower[i:], lowerName)
		if idx == -1 {
			result.WriteString(text[i:])
			break
		}

		matchPos := i + idx
		result.WriteString(text[i:matchPos])

		// Determine if plural context by checking the preceding word
		plural := false
		if matchPos > 0 {
			preceding := strings.TrimRight(text[:matchPos], " ")
			spaceIdx := strings.LastIndexByte(preceding, ' ')
			var prevWord string
			if spaceIdx >= 0 {
				prevWord = strings.ToLower(preceding[spaceIdx+1:])
			} else {
				prevWord = strings.ToLower(preceding)
			}
			plural = pluralHints[prevWord]
		}

		// Determine if at sentence start
		atStart := matchPos == 0
		if !atStart {
			before := strings.TrimRight(text[:matchPos], " ")
			if len(before) > 0 && (before[len(before)-1] == '.' || before[len(before)-1] == '!' || before[len(before)-1] == '?') {
				atStart = true
			}
		}

		replacement := "this Pokémon"
		if plural {
			replacement = "of these Pokémon"
		}
		if atStart {
			replacement = string(unicode.ToUpper(rune(replacement[0]))) + replacement[1:]
		}

		result.WriteString(replacement)
		i = matchPos + len(lowerName)
	}

	return result.String()
}

// MaskPokemonNameJA replaces a Pokemon's Japanese name in text with "この ポケモン".
func MaskPokemonNameJA(text, name string) string {
	if name == "" {
		return text
	}
	return strings.ReplaceAll(text, name, "この ポケモン")
}
