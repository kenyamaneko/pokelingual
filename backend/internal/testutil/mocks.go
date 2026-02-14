package testutil

import (
	"context"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// MockAIScorer implements domain.AIScorer for testing.
type MockAIScorer struct {
	ScoreToReturn        float64
	ReviewToReturn       string
	ChatResponseToReturn string
	ErrorToReturn        error
	ChatErrorToReturn    error
	CalledWith           []MockScoreCall
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
		Score:   m.ScoreToReturn,
		Review: m.ReviewToReturn,
	}, nil
}

func (m *MockAIScorer) Chat(ctx context.Context, chatCtx *model.ChatContext, messages []model.ChatMessage) (string, error) {
	if m.ChatErrorToReturn != nil {
		return "", m.ChatErrorToReturn
	}
	if m.ChatResponseToReturn != "" {
		return m.ChatResponseToReturn, nil
	}
	return "テスト用の 博士の 返答だよ。", nil
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

// MockUserSettingsRepo implements domain.UserSettingsRepository for testing.
type MockUserSettingsRepo struct {
	Settings      *model.UserSettings
	ErrorToReturn error
	UpdateCalls   []MockUpdateExcludedCall
}

type MockUpdateExcludedCall struct {
	UID        string
	PokemonIDs []int
}

func (m *MockUserSettingsRepo) GetSettings(ctx context.Context, uid string) (*model.UserSettings, error) {
	if m.ErrorToReturn != nil {
		return nil, m.ErrorToReturn
	}
	if m.Settings == nil {
		return &model.UserSettings{}, nil // nil ExcludedPokemonIDs = use defaults
	}
	return m.Settings, nil
}

func (m *MockUserSettingsRepo) UpdateExcludedPokemon(ctx context.Context, uid string, pokemonIDs []int) error {
	m.UpdateCalls = append(m.UpdateCalls, MockUpdateExcludedCall{
		UID:        uid,
		PokemonIDs: pokemonIDs,
	})
	return m.ErrorToReturn
}
