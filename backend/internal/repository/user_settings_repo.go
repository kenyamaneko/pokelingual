package repository

import (
	"context"
	"fmt"

	"cloud.google.com/go/firestore"
	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UserSettingsRepo implements domain.UserSettingsRepository using Cloud Firestore.
type UserSettingsRepo struct {
	client *firestore.Client
}

// NewUserSettingsRepo creates a new UserSettingsRepo.
func NewUserSettingsRepo(client *firestore.Client) *UserSettingsRepo {
	return &UserSettingsRepo{client: client}
}

func (r *UserSettingsRepo) settingsRef(uid string) *firestore.DocumentRef {
	return r.client.Collection("users").Doc(uid).Collection("settings").Doc("preferences")
}

// GetSettings returns the user's settings, or default settings if none exist.
func (r *UserSettingsRepo) GetSettings(ctx context.Context, uid string) (*model.UserSettings, error) {
	doc, err := r.settingsRef(uid).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return &model.UserSettings{ExcludedPokemonIDs: []int{}}, nil
		}
		return nil, fmt.Errorf("getting settings: %w", err)
	}

	var settings model.UserSettings
	if err := doc.DataTo(&settings); err != nil {
		return nil, fmt.Errorf("parsing settings: %w", err)
	}

	if settings.ExcludedPokemonIDs == nil {
		settings.ExcludedPokemonIDs = []int{}
	}

	return &settings, nil
}

// UpdateExcludedPokemon updates the user's excluded Pokemon IDs list.
func (r *UserSettingsRepo) UpdateExcludedPokemon(ctx context.Context, uid string, pokemonIDs []int) error {
	_, err := r.settingsRef(uid).Set(ctx, map[string]interface{}{
		"excluded_pokemon_ids": pokemonIDs,
	}, firestore.MergeAll)
	if err != nil {
		return fmt.Errorf("updating excluded pokemon: %w", err)
	}
	return nil
}
