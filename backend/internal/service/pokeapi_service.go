package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// versionOrder defines the display order for game versions with EN/JA pairs.
var versionOrder = []string{
	"x", "y", "omega-ruby", "alpha-sapphire",
	"sun", "moon", "ultra-sun", "ultra-moon",
	"lets-go-pikachu", "lets-go-eevee",
	"sword", "shield",
}

// versionDisplayNames maps PokeAPI version names to Japanese display names.
var versionDisplayNames = map[string]string{
	"x":               "X",
	"y":               "Y",
	"omega-ruby":      "Ωルビー",
	"alpha-sapphire":  "αサファイア",
	"sun":             "サン",
	"moon":            "ムーン",
	"ultra-sun":       "Uサン",
	"ultra-moon":      "Uムーン",
	"lets-go-pikachu": "ピカブイ",
	"lets-go-eevee":   "ピカブイ",
	"sword":           "ソード",
	"shield":          "シールド",
}

// MaxPokemonID is the maximum Pokemon ID in the supported range (Gen 1-8, excluding Legends: Arceus).
// Default is 898; can be overridden from Firestore config/app at startup.
var MaxPokemonID = 898

// DefaultExcludedPokemonIDs is the default exclusion list for new users.
// Can be overridden from Firestore config/app at startup.
// Some users have phobias of certain creatures (e.g. spiders), so these Pokemon
// are excluded by default to ensure a comfortable experience.
var DefaultExcludedPokemonIDs = []int{167, 168, 595, 596, 751, 752}

// PokeAPIService implements domain.PokemonFetcher using the PokeAPI with in-memory caching.
type PokeAPIService struct {
	cache      sync.Map
	httpClient *http.Client
}

// NewPokeAPIService creates a new PokeAPIService.
func NewPokeAPIService() *PokeAPIService {
	return &PokeAPIService{
		httpClient: &http.Client{},
	}
}

type pokeAPISpeciesResponse struct {
	ID               int `json:"id"`
	Names            []struct {
		Name     string `json:"name"`
		Language struct {
			Name string `json:"name"`
		} `json:"language"`
	} `json:"names"`
	FlavorTextEntries []struct {
		FlavorText string `json:"flavor_text"`
		Language   struct {
			Name string `json:"name"`
		} `json:"language"`
		Version struct {
			Name string `json:"name"`
		} `json:"version"`
	} `json:"flavor_text_entries"`
}

type pokeAPIPokemonResponse struct {
	Sprites struct {
		FrontDefault string `json:"front_default"`
		Other        struct {
			OfficialArtwork struct {
				FrontDefault string `json:"front_default"`
			} `json:"official-artwork"`
		} `json:"other"`
	} `json:"sprites"`
}

// TotalAvailablePokemon returns the total number of Pokemon available for quests,
// accounting for user-specific exclusions.
func TotalAvailablePokemon(userExcludedIDs []int) int {
	return MaxPokemonID - len(userExcludedIDs)
}

// GetRandomPokemon returns a random Pokemon from the supported range (ID 1-MaxPokemonID).
// Per-user exclusion filtering is handled by QuestService.
func (s *PokeAPIService) GetRandomPokemon(ctx context.Context) (*model.Pokemon, error) {
	id := rand.Intn(MaxPokemonID) + 1
	return s.GetPokemonByID(ctx, id)
}

// GetPokemonByID returns a Pokemon by ID, using a cache to avoid repeated API calls.
func (s *PokeAPIService) GetPokemonByID(ctx context.Context, id int) (*model.Pokemon, error) {
	if cached, ok := s.cache.Load(id); ok {
		return cached.(*model.Pokemon), nil
	}

	pokemon, err := s.fetchFromAPI(ctx, id)
	if err != nil {
		return nil, err
	}

	s.cache.Store(id, pokemon)
	return pokemon, nil
}

func (s *PokeAPIService) fetchFromAPI(ctx context.Context, id int) (*model.Pokemon, error) {
	speciesURL := fmt.Sprintf("https://pokeapi.co/api/v2/pokemon-species/%d", id)
	speciesReq, err := http.NewRequestWithContext(ctx, "GET", speciesURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating species request: %w", err)
	}

	speciesResp, err := s.httpClient.Do(speciesReq)
	if err != nil {
		return nil, fmt.Errorf("fetching species: %w", err)
	}
	defer func() { _ = speciesResp.Body.Close() }()

	if speciesResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("species API returned status %d", speciesResp.StatusCode)
	}

	var species pokeAPISpeciesResponse
	if err := json.NewDecoder(speciesResp.Body).Decode(&species); err != nil {
		return nil, fmt.Errorf("decoding species: %w", err)
	}

	pokemonURL := fmt.Sprintf("https://pokeapi.co/api/v2/pokemon/%d", id)
	pokemonReq, err := http.NewRequestWithContext(ctx, "GET", pokemonURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating pokemon request: %w", err)
	}

	pokemonResp, err := s.httpClient.Do(pokemonReq)
	if err != nil {
		return nil, fmt.Errorf("fetching pokemon: %w", err)
	}
	defer func() { _ = pokemonResp.Body.Close() }()

	var pokemonData pokeAPIPokemonResponse
	if err := json.NewDecoder(pokemonResp.Body).Decode(&pokemonData); err != nil {
		return nil, fmt.Errorf("decoding pokemon: %w", err)
	}

	nameEN := ""
	nameJA := ""
	for _, name := range species.Names {
		switch name.Language.Name {
		case "en":
			nameEN = name.Name
		case "ja":
			nameJA = name.Name
		}
	}

	flavorTexts := buildFlavorTextPairs(species.FlavorTextEntries)

	if len(flavorTexts) == 0 {
		return nil, fmt.Errorf("no EN/JA description pair found for pokemon %d", id)
	}

	// Use the first pair as the default description (version-matched)
	descriptionEN := flavorTexts[0].DescriptionEN
	descriptionJA := flavorTexts[0].DescriptionJA

	spriteURL := pokemonData.Sprites.Other.OfficialArtwork.FrontDefault
	if spriteURL == "" {
		spriteURL = pokemonData.Sprites.FrontDefault
	}

	return &model.Pokemon{
		ID:            id,
		NameEN:        nameEN,
		NameJA:        nameJA,
		DescriptionEN: descriptionEN,
		DescriptionJA: descriptionJA,
		SpriteURL:     spriteURL,
		FlavorTexts:   flavorTexts,
	}, nil
}

// flavorTextsByVersion collects EN and JA texts per game version.
type flavorTextsByVersion struct {
	en     string
	ja     string
	jaHrkt string
}

// buildFlavorTextPairs groups flavor_text_entries by version, creates EN/JA pairs,
// deduplicates identical text pairs, and sorts by version order.
func buildFlavorTextPairs(entries []struct {
	FlavorText string `json:"flavor_text"`
	Language   struct {
		Name string `json:"name"`
	} `json:"language"`
	Version struct {
		Name string `json:"name"`
	} `json:"version"`
}) []model.FlavorTextPair {
	// Collect texts by version
	byVersion := map[string]*flavorTextsByVersion{}
	for _, entry := range entries {
		ver := entry.Version.Name
		if _, ok := versionDisplayNames[ver]; !ok {
			continue // skip versions we don't display
		}
		if byVersion[ver] == nil {
			byVersion[ver] = &flavorTextsByVersion{}
		}
		text := cleanFlavorText(entry.FlavorText)
		switch entry.Language.Name {
		case "en":
			byVersion[ver].en = text
		case "ja":
			byVersion[ver].ja = text
		case "ja-Hrkt":
			byVersion[ver].jaHrkt = text
		}
	}

	// Build pairs: only versions with both EN and JA (or ja-Hrkt fallback)
	type versionPair struct {
		version string
		en      string
		ja      string
	}
	var pairs []versionPair
	for ver, texts := range byVersion {
		ja := texts.ja
		if ja == "" {
			ja = texts.jaHrkt
		}
		if texts.en == "" || ja == "" {
			continue
		}
		pairs = append(pairs, versionPair{version: ver, en: texts.en, ja: ja})
	}

	// Sort by predefined version order
	orderIndex := map[string]int{}
	for i, v := range versionOrder {
		orderIndex[v] = i
	}
	sort.Slice(pairs, func(i, j int) bool {
		return orderIndex[pairs[i].version] < orderIndex[pairs[j].version]
	})

	// Deduplicate: merge versions with identical EN+JA text
	var result []model.FlavorTextPair
	for _, p := range pairs {
		displayName := versionDisplayNames[p.version]
		merged := false
		for i := range result {
			if result[i].DescriptionEN == p.en && result[i].DescriptionJA == p.ja {
				// Avoid duplicate display names (e.g. two "ピカブイ")
				alreadyHas := false
				for _, name := range result[i].VersionNames {
					if name == displayName {
						alreadyHas = true
						break
					}
				}
				if !alreadyHas {
					result[i].VersionNames = append(result[i].VersionNames, displayName)
				}
				merged = true
				break
			}
		}
		if !merged {
			result = append(result, model.FlavorTextPair{
				VersionNames:  []string{displayName},
				DescriptionEN: p.en,
				DescriptionJA: p.ja,
			})
		}
	}

	return result
}

func cleanFlavorText(text string) string {
	text = strings.ReplaceAll(text, "\f", " ")
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.ReplaceAll(text, "\r", " ")

	for strings.Contains(text, "  ") {
		text = strings.ReplaceAll(text, "  ", " ")
	}

	return strings.TrimSpace(text)
}
