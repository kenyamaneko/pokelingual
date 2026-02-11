package testutil

import (
	"context"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// MockAIScorer implements domain.AIScorer for testing.
type MockAIScorer struct {
	ScoreToReturn float64
	ErrorToReturn error
	CalledWith    []MockScoreCall
}

type MockScoreCall struct {
	EnglishText         string
	JapaneseTranslation string
}

func (m *MockAIScorer) ScoreTranslation(ctx context.Context, englishText, japaneseTranslation string) (*model.ScoreResult, error) {
	m.CalledWith = append(m.CalledWith, MockScoreCall{
		EnglishText:         englishText,
		JapaneseTranslation: japaneseTranslation,
	})
	if m.ErrorToReturn != nil {
		return nil, m.ErrorToReturn
	}
	return &model.ScoreResult{
		Score: m.ScoreToReturn,
	}, nil
}

// MockPokemonFetcher implements domain.PokemonFetcher for testing.
type MockPokemonFetcher struct {
	PokemonToReturn *model.Pokemon
	ErrorToReturn   error
}

func (m *MockPokemonFetcher) GetRandomPokemon(ctx context.Context) (*model.Pokemon, error) {
	if m.ErrorToReturn != nil {
		return nil, m.ErrorToReturn
	}
	return m.PokemonToReturn, nil
}

func (m *MockPokemonFetcher) GetPokemonByID(ctx context.Context, id int) (*model.Pokemon, error) {
	if m.ErrorToReturn != nil {
		return nil, m.ErrorToReturn
	}
	return m.PokemonToReturn, nil
}

// MockUserPokemonRepo implements domain.UserPokemonRepository for testing.
type MockUserPokemonRepo struct {
	Collection      []model.UserPokemon
	Pokemon         *model.UserPokemon
	UpsertCalls     []MockUpsertCall
	ErrorToReturn   error
}

type MockUpsertCall struct {
	UID       string
	PokemonID int
	Score     float64
	Captured  bool
}

func (m *MockUserPokemonRepo) UpsertEncounter(ctx context.Context, uid string, pokemonID int, score float64, captured bool) error {
	m.UpsertCalls = append(m.UpsertCalls, MockUpsertCall{
		UID:       uid,
		PokemonID: pokemonID,
		Score:     score,
		Captured:  captured,
	})
	return m.ErrorToReturn
}

func (m *MockUserPokemonRepo) GetCollection(ctx context.Context, uid string) ([]model.UserPokemon, error) {
	if m.ErrorToReturn != nil {
		return nil, m.ErrorToReturn
	}
	return m.Collection, nil
}

func (m *MockUserPokemonRepo) GetPokemon(ctx context.Context, uid string, pokemonID int) (*model.UserPokemon, error) {
	if m.ErrorToReturn != nil {
		return nil, m.ErrorToReturn
	}
	return m.Pokemon, nil
}
