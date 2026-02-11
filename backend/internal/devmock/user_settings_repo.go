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

// NewUserSettingsRepo creates a new mock UserSettingsRepo with default excluded Pokemon.
func NewUserSettingsRepo() *UserSettingsRepo {
	return &UserSettingsRepo{
		settings: map[string]*model.UserSettings{
			"dev-user": {
				ExcludedPokemonIDs: []int{167, 168, 595, 596},
			},
		},
	}
}

// GetSettings returns the user's settings or defaults.
func (r *UserSettingsRepo) GetSettings(_ context.Context, uid string) (*model.UserSettings, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if s, ok := r.settings[uid]; ok {
		return s, nil
	}
	return &model.UserSettings{ExcludedPokemonIDs: []int{}}, nil
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
