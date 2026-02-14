package domain

import (
	"context"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// AIScorer scores English-to-Japanese translations and provides chat capabilities.
// Implement this interface to swap between Gemini, Claude, OpenAI, etc.
type AIScorer interface {
	ScoreTranslation(ctx context.Context, englishText, japaneseTranslation string) (*model.ScoreResult, error)
	Chat(ctx context.Context, chatCtx *model.ChatContext, messages []model.ChatMessage) (string, error)
}

// PokemonFetcher fetches Pokemon data from an external source.
type PokemonFetcher interface {
	GetRandomPokemon(ctx context.Context) (*model.Pokemon, error)
	GetPokemonByID(ctx context.Context, id int) (*model.Pokemon, error)
}

// UserPokemonRepository manages user's Pokemon collection data.
type UserPokemonRepository interface {
	UpsertEncounter(ctx context.Context, uid string, pokemonID int, score float64, captured bool) error
	GetCollection(ctx context.Context, uid string) ([]model.UserPokemon, error)
	GetPokemon(ctx context.Context, uid string, pokemonID int) (*model.UserPokemon, error)
}

// UserSettingsRepository manages per-user preferences such as excluded Pokemon.
type UserSettingsRepository interface {
	GetSettings(ctx context.Context, uid string) (*model.UserSettings, error)
	UpdateExcludedPokemon(ctx context.Context, uid string, pokemonIDs []int) error
}
