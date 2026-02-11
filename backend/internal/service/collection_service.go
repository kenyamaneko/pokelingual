package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/kenyamamoto/pokelingual/backend/internal/apperror"
	"github.com/kenyamamoto/pokelingual/backend/internal/domain"
	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// CollectionService provides access to the user's captured Pokemon collection.
type CollectionService struct {
	repo           domain.UserPokemonRepository
	pokemonFetcher domain.PokemonFetcher
}

// CollectionEntry represents a single Pokemon in the user's collection list.
type CollectionEntry struct {
	PokemonID     int     `json:"pokemon_id"`
	NameEN        string  `json:"name_en"`
	NameJA        string  `json:"name_ja"`
	SpriteURL     string  `json:"sprite_url"`
	Status        string  `json:"status"`
	TotalCaptures int     `json:"total_captures"`
	BestScore     float64 `json:"best_score"`
}

// PokemonDetailResponse is the API response for a captured Pokemon's details.
type PokemonDetailResponse struct {
	model.UserPokemon
	NameEN        string                 `json:"name_en"`
	NameJA        string                 `json:"name_ja"`
	DescriptionEN string                 `json:"description_en"`
	DescriptionJA string                 `json:"description_ja"`
	SpriteURL     string                 `json:"sprite_url"`
	FlavorTexts   []model.FlavorTextPair `json:"flavor_texts,omitempty"`
}

// NewCollectionService creates a new CollectionService.
func NewCollectionService(repo domain.UserPokemonRepository, pokemonFetcher domain.PokemonFetcher) *CollectionService {
	return &CollectionService{
		repo:           repo,
		pokemonFetcher: pokemonFetcher,
	}
}

// GetCollection returns all discovered Pokemon for the given user.
func (s *CollectionService) GetCollection(ctx context.Context, uid string) ([]CollectionEntry, error) {
	pokemons, err := s.repo.GetCollection(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("getting collection: %w", err)
	}

	entries := make([]CollectionEntry, 0, len(pokemons))
	for _, up := range pokemons {
		pokemon, err := s.pokemonFetcher.GetPokemonByID(ctx, up.PokemonID)
		if err != nil {
			slog.Warn("failed to fetch pokemon data, skipping", "pokemon_id", up.PokemonID, "error", err)
			continue
		}
		entries = append(entries, CollectionEntry{
			PokemonID:     up.PokemonID,
			NameEN:        pokemon.NameEN,
			NameJA:        pokemon.NameJA,
			SpriteURL:     pokemon.SpriteURL,
			Status:        up.Status,
			TotalCaptures: up.TotalCaptures,
			BestScore:     up.BestScore,
		})
	}

	return entries, nil
}

// GetPokemonDetail returns the full details of a specific captured Pokemon.
func (s *CollectionService) GetPokemonDetail(ctx context.Context, uid string, pokemonID int) (*PokemonDetailResponse, error) {
	userPokemon, err := s.repo.GetPokemon(ctx, uid, pokemonID)
	if err != nil {
		return nil, fmt.Errorf("getting user pokemon: %w", err)
	}

	pokemon, err := s.pokemonFetcher.GetPokemonByID(ctx, pokemonID)
	if err != nil {
		return nil, apperror.NewExternalServiceError("PokeAPI", err)
	}

	return &PokemonDetailResponse{
		UserPokemon:   *userPokemon,
		NameEN:        pokemon.NameEN,
		NameJA:        pokemon.NameJA,
		DescriptionEN: pokemon.DescriptionEN,
		DescriptionJA: pokemon.DescriptionJA,
		SpriteURL:     pokemon.SpriteURL,
		FlavorTexts:   pokemon.FlavorTexts,
	}, nil
}
