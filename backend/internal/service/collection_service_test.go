package service_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
	"github.com/kenyamamoto/pokelingual/backend/internal/testutil"
)

func TestGetCollection(t *testing.T) {
	// Given: a repo with 2 captured and 1 seen Pokemon
	repo := &testutil.MockUserPokemonRepo{
		Collection: []model.UserPokemon{
			{PokemonID: 25, Status: "captured", TotalCaptures: 3, BestScore: 90},
			{PokemonID: 1, Status: "captured", TotalCaptures: 1, BestScore: 75},
			{PokemonID: 4, Status: "seen", TotalCaptures: 0, BestScore: 60},
		},
	}
	fetcher := &testutil.MockPokemonFetcher{
		PokemonToReturn: newTestPokemon(),
	}
	svc := service.NewCollectionService(repo, fetcher)

	// When: getting the collection
	entries, err := svc.GetCollection(context.Background(), "user1")

	// Then: returns all 3 entries (both captured and seen)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 3 {
		t.Errorf("expected 3 entries, got %d", len(entries))
	}

	// Verify status is propagated
	capturedCount := 0
	seenCount := 0
	for _, e := range entries {
		switch e.Status {
		case "captured":
			capturedCount++
		case "seen":
			seenCount++
		}
	}
	if capturedCount != 2 {
		t.Errorf("expected 2 captured, got %d", capturedCount)
	}
	if seenCount != 1 {
		t.Errorf("expected 1 seen, got %d", seenCount)
	}
}

func TestGetCollection_Empty(t *testing.T) {
	// Given: a repo with no Pokemon
	repo := &testutil.MockUserPokemonRepo{
		Collection: []model.UserPokemon{},
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	svc := service.NewCollectionService(repo, fetcher)

	// When: getting the collection
	entries, err := svc.GetCollection(context.Background(), "user1")

	// Then: returns empty list
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}
}

func TestGetCollection_RepoError(t *testing.T) {
	// Given: a repo that returns a DB error
	repo := &testutil.MockUserPokemonRepo{ErrorToReturn: fmt.Errorf("db error")}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	svc := service.NewCollectionService(repo, fetcher)

	// When: getting the collection
	_, err := svc.GetCollection(context.Background(), "user1")

	// Then: returns an error
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestGetPokemonDetail(t *testing.T) {
	// Given: Pikachu captured 5 times with best score 92
	now := time.Now()
	repo := &testutil.MockUserPokemonRepo{
		Pokemon: &model.UserPokemon{
			PokemonID:         25,
			Status:            "captured",
			TotalCaptures:     5,
			TotalEncounters:   10,
			LastCapturedAt:    now,
			LastEncounteredAt: now,
			BestScore:         92,
		},
	}
	fetcher := &testutil.MockPokemonFetcher{PokemonToReturn: newTestPokemon()}
	svc := service.NewCollectionService(repo, fetcher)

	// When: getting Pokemon detail for ID 25
	detail, err := svc.GetPokemonDetail(context.Background(), "user1", 25)

	// Then: returns Pikachu's detail with stats
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detail.NameEN != "Pikachu" {
		t.Errorf("expected Pikachu, got %s", detail.NameEN)
	}
	if detail.BestScore != 92 {
		t.Errorf("expected best score 92, got %f", detail.BestScore)
	}
	if detail.TotalCaptures != 5 {
		t.Errorf("expected 5 captures, got %d", detail.TotalCaptures)
	}
}
