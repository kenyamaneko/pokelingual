package devmock

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// UserPokemonRepo implements domain.UserPokemonRepository with in-memory storage.
type UserPokemonRepo struct {
	mu   sync.Mutex
	data map[string]map[int]*model.UserPokemon // uid -> pokemonID -> record
}

// NewUserPokemonRepo creates a new in-memory UserPokemonRepo.
func NewUserPokemonRepo() *UserPokemonRepo {
	return &UserPokemonRepo{
		data: make(map[string]map[int]*model.UserPokemon),
	}
}

// UpsertEncounter creates or updates a user's encounter record for a Pokemon.
func (r *UserPokemonRepo) UpsertEncounter(ctx context.Context, uid string, pokemonID int, score float64, captured bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.data[uid] == nil {
		r.data[uid] = make(map[int]*model.UserPokemon)
	}

	now := time.Now()
	existing, ok := r.data[uid][pokemonID]
	if !ok {
		status := "seen"
		if captured {
			status = "captured"
		}
		up := &model.UserPokemon{
			PokemonID:         pokemonID,
			Status:            status,
			TotalCaptures:     boolToInt(captured),
			TotalEncounters:   1,
			LastEncounteredAt: now,
			BestScore:         score,
		}
		if captured {
			up.LastCapturedAt = now
		}
		r.data[uid][pokemonID] = up
		return nil
	}

	existing.TotalEncounters++
	existing.LastEncounteredAt = now
	if captured {
		existing.TotalCaptures++
		existing.Status = "captured"
		existing.LastCapturedAt = now
	}
	if score > existing.BestScore {
		existing.BestScore = score
	}
	return nil
}

// GetCollection returns all discovered Pokemon for the given user, ordered by Pokemon ID.
func (r *UserPokemonRepo) GetCollection(ctx context.Context, uid string) ([]model.UserPokemon, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	result := make([]model.UserPokemon, 0)
	for _, up := range r.data[uid] {
		result = append(result, *up)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].PokemonID < result[j].PokemonID
	})
	return result, nil
}

// GetPokemon returns a specific Pokemon record for the given user.
func (r *UserPokemonRepo) GetPokemon(ctx context.Context, uid string, pokemonID int) (*model.UserPokemon, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.data[uid] == nil {
		return nil, fmt.Errorf("pokemon not found")
	}
	up, ok := r.data[uid][pokemonID]
	if !ok {
		return nil, fmt.Errorf("pokemon not found")
	}
	return up, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
