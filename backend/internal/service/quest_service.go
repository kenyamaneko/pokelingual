package service

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"sync"

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
	Multiplier        float64 `json:"multiplier,omitempty"`
	Language          string `json:"language,omitempty"`
	Fuzzy             bool   `json:"fuzzy,omitempty"`
	AttemptsRemaining int    `json:"attempts_remaining"`
	RevealNameEN      string `json:"reveal_name_en,omitempty"`
	RevealNameJA      string `json:"reveal_name_ja,omitempty"`
}

// CaptureResponse is the API response for a capture attempt.
type CaptureResponse struct {
	Captured      bool    `json:"captured"`
	Probability   float64 `json:"probability"`
	PokemonID     int     `json:"pokemon_id"`
	NameEN        string  `json:"name_en"`
	NameJA        string  `json:"name_ja"`
	SpriteURL     string  `json:"sprite_url"`
	Score         float64 `json:"score"`
	DescriptionEN string  `json:"description_en"`
	DescriptionJA string  `json:"description_ja"`
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
	}
	s.sessions.Store(uid, session)

	return &QuestNewResponse{
		PokemonID:     pokemon.ID,
		DescriptionEN: descEN,
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
		DescriptionJA: session.DescriptionJA,
	}, nil
}

// GuessName evaluates a Pokemon name guess with exact, fuzzy, and Japanese matching.
func (s *QuestService) GuessName(ctx context.Context, uid string, guess string) (*GuessResponse, error) {
	session, err := s.getSession(uid)
	if err != nil {
		return nil, err
	}

	if session.NameGuessed {
		return &GuessResponse{
			Correct:           true,
			Multiplier:        session.NameMultiplier,
			AttemptsRemaining: 0,
		}, nil
	}

	session.GuessAttempts++

	guessNorm := strings.ToLower(strings.TrimSpace(guess))
	nameENNorm := strings.ToLower(session.NameEN)
	guessJA := strings.TrimSpace(guess)

	if guessNorm == nameENNorm {
		session.NameMultiplier = 1.5
		session.NameGuessed = true
		return &GuessResponse{
			Correct:           true,
			Multiplier:        1.5,
			Language:          "en",
			AttemptsRemaining: 3 - session.GuessAttempts,
		}, nil
	}

	if guessJA == session.NameJA {
		session.NameMultiplier = 1.0
		session.NameGuessed = true
		return &GuessResponse{
			Correct:           true,
			Multiplier:        1.0,
			Language:          "ja",
			AttemptsRemaining: 3 - session.GuessAttempts,
		}, nil
	}

	if len(nameENNorm) > 3 {
		dist := levenshtein.ComputeDistance(guessNorm, nameENNorm)
		if dist <= 2 {
			session.NameMultiplier = 1.5
			session.NameGuessed = true
			return &GuessResponse{
				Correct:           true,
				Multiplier:        1.5,
				Language:          "en",
				Fuzzy:             true,
				AttemptsRemaining: 3 - session.GuessAttempts,
			}, nil
		}
	}

	session.WrongGuesses++

	remaining := 3 - session.GuessAttempts
	if remaining <= 0 {
		session.NameMultiplier = 0.5
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

// AttemptCapture calculates capture probability and determines if the Pokemon is caught.
func (s *QuestService) AttemptCapture(ctx context.Context, uid string) (*CaptureResponse, error) {
	session, err := s.getSession(uid)
	if err != nil {
		return nil, err
	}

	multiplier := session.NameMultiplier
	if multiplier == 0 {
		multiplier = 0.5
	}

	guessPenalty := 1.0 - float64(session.WrongGuesses)*0.05
	probability := (session.Score / 100.0) * multiplier * guessPenalty
	if probability > 1.0 {
		probability = 1.0
	}

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
	}, nil
}

func (s *QuestService) getSession(uid string) (*model.QuestSession, error) {
	val, ok := s.sessions.Load(uid)
	if !ok {
		return nil, fmt.Errorf("no active quest session: %w", apperror.ErrNotFound)
	}
	return val.(*model.QuestSession), nil
}
