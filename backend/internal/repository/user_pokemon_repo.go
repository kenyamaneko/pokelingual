package repository

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UserPokemonRepo implements domain.UserPokemonRepository using Cloud Firestore.
type UserPokemonRepo struct {
	client *firestore.Client
}

// NewUserPokemonRepo creates a new UserPokemonRepo.
func NewUserPokemonRepo(client *firestore.Client) *UserPokemonRepo {
	return &UserPokemonRepo{client: client}
}

// UpsertEncounter creates or updates a user's encounter record for a Pokemon using a transaction.
func (r *UserPokemonRepo) UpsertEncounter(ctx context.Context, uid string, pokemonID int, score float64, captured bool) error {
	ref := r.client.Collection("users").Doc(uid).
		Collection("pokemon").Doc(strconv.Itoa(pokemonID))

	return r.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		doc, err := tx.Get(ref)
		if err != nil {
			if status.Code(err) == codes.NotFound {
				s := "seen"
				if captured {
					s = "captured"
				}
				now := time.Now()
				up := model.UserPokemon{
					PokemonID:         pokemonID,
					Status:            s,
					TotalCaptures:     boolToInt(captured),
					TotalEncounters:   1,
					LastEncounteredAt: now,
					BestScore:         score,
				}
				if captured {
					up.LastCapturedAt = now
				}
				return tx.Set(ref, up)
			}
			return fmt.Errorf("getting document: %w", err)
		}

		var existing model.UserPokemon
		if err := doc.DataTo(&existing); err != nil {
			return fmt.Errorf("parsing document: %w", err)
		}

		existing.TotalEncounters++
		existing.LastEncounteredAt = time.Now()

		if captured {
			existing.TotalCaptures++
			existing.Status = "captured"
			existing.LastCapturedAt = time.Now()
		}

		if score > existing.BestScore {
			existing.BestScore = score
		}

		return tx.Set(ref, existing)
	})
}

// GetCollection returns all discovered Pokemon for the given user, ordered by Pokemon ID.
func (r *UserPokemonRepo) GetCollection(ctx context.Context, uid string) ([]model.UserPokemon, error) {
	docs, err := r.client.Collection("users").Doc(uid).
		Collection("pokemon").
		OrderBy("pokemon_id", firestore.Asc).
		Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("querying collection: %w", err)
	}

	result := make([]model.UserPokemon, 0, len(docs))
	for _, doc := range docs {
		var up model.UserPokemon
		if err := doc.DataTo(&up); err != nil {
			slog.Warn("failed to parse pokemon document, skipping", "doc_id", doc.Ref.ID, "error", err)
			continue
		}
		result = append(result, up)
	}

	return result, nil
}

// GetPokemon returns a specific Pokemon record for the given user.
func (r *UserPokemonRepo) GetPokemon(ctx context.Context, uid string, pokemonID int) (*model.UserPokemon, error) {
	doc, err := r.client.Collection("users").Doc(uid).
		Collection("pokemon").Doc(strconv.Itoa(pokemonID)).Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting pokemon: %w", err)
	}

	var up model.UserPokemon
	if err := doc.DataTo(&up); err != nil {
		return nil, fmt.Errorf("parsing pokemon: %w", err)
	}

	return &up, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
