package devmock

import (
	"context"
	"sync"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// UserSettingsRepo implements domain.UserSettingsRepository with in-memory storage.
type UserSettingsRepo struct {
	mu       sync.Mutex
	settings map[string]*model.UserSettings
}

// NewUserSettingsRepo creates a new mock UserSettingsRepo.
func NewUserSettingsRepo() *UserSettingsRepo {
	return &UserSettingsRepo{
		settings: map[string]*model.UserSettings{},
	}
}

// GetSettings returns the user's settings.
// Returns nil ExcludedPokemonIDs if the user has no settings (callers use defaults).
func (r *UserSettingsRepo) GetSettings(_ context.Context, uid string) (*model.UserSettings, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if s, ok := r.settings[uid]; ok {
		return s, nil
	}
	return &model.UserSettings{}, nil // nil ExcludedPokemonIDs = use defaults
}

// UpdateExcludedPokemon updates the user's excluded Pokemon IDs.
func (r *UserSettingsRepo) UpdateExcludedPokemon(_ context.Context, uid string, pokemonIDs []int) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.settings[uid]; !ok {
		r.settings[uid] = &model.UserSettings{}
	}
	r.settings[uid].ExcludedPokemonIDs = pokemonIDs
	return nil
}
