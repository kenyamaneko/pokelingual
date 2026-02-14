package main

import (
	"context"
	"log"
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
	"google.golang.org/genai"

	"github.com/kenyamamoto/pokelingual/backend/internal/config"
	"github.com/kenyamamoto/pokelingual/backend/internal/devmock"
	"github.com/kenyamamoto/pokelingual/backend/internal/domain"
	"github.com/kenyamamoto/pokelingual/backend/internal/handler"
	"github.com/kenyamamoto/pokelingual/backend/internal/middleware"
	"github.com/kenyamamoto/pokelingual/backend/internal/repository"
	"github.com/kenyamamoto/pokelingual/backend/internal/router"
	"github.com/kenyamamoto/pokelingual/backend/internal/service"
)

func main() {
	cfg := config.Load()

	// Cloud Logging は JSON の "severity" フィールドで重要度を認識する。
	// slog のデフォルト "level" を "severity" にリネームし、
	// 値を Cloud Logging 形式（INFO, WARNING, ERROR）にマッピングする。
	if cfg.AppMode != "mock" {
		slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
				if a.Key == slog.LevelKey {
					switch a.Value.Any().(slog.Level) {
					case slog.LevelWarn:
						a.Value = slog.StringValue("WARNING")
					case slog.LevelError:
						a.Value = slog.StringValue("ERROR")
					default:
						a.Value = slog.StringValue(a.Value.String())
					}
					a.Key = "severity"
				}
				if a.Key == slog.MessageKey {
					a.Key = "message"
				}
				return a
			},
		})))
	}

	var pokemonFetcher domain.PokemonFetcher
	var aiScorer domain.AIScorer
	var userPokemonRepo domain.UserPokemonRepository
	var userSettingsRepo domain.UserSettingsRepository
	var authMiddleware gin.HandlerFunc

	if cfg.AppMode == "mock" {
		log.Println("Starting in mock mode with devmock services")
		pokemonFetcher = devmock.NewPokemonFetcher()
		aiScorer = devmock.NewAIScorer()
		userPokemonRepo = devmock.NewUserPokemonRepo()
		userSettingsRepo = devmock.NewUserSettingsRepo()
		authMiddleware = devmock.DevAuth()
	} else {
		ctx := context.Background()

		// Initialize Firebase
		var firebaseApp *firebase.App
		var err error
		if cfg.FirebaseCredentialsPath != "" {
			opt := option.WithCredentialsFile(cfg.FirebaseCredentialsPath)
			firebaseApp, err = firebase.NewApp(ctx, nil, opt)
		} else {
			firebaseApp, err = firebase.NewApp(ctx, nil)
		}
		if err != nil {
			log.Fatalf("failed to initialize firebase: %v", err)
		}

		authClient, err := firebaseApp.Auth(ctx)
		if err != nil {
			log.Fatalf("failed to initialize firebase auth: %v", err)
		}

		firestoreClient, err := firebaseApp.Firestore(ctx)
		if err != nil {
			log.Fatalf("failed to initialize firestore: %v", err)
		}
		defer func() { _ = firestoreClient.Close() }()

		// Initialize Gemini
		geminiClient, err := genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  cfg.GeminiAPIKey,
			Backend: genai.BackendGeminiAPI,
		})
		if err != nil {
			log.Fatalf("failed to initialize gemini: %v", err)
		}

		// Read allowed emails from Firestore (config/auth document)
		// If the document is missing or unreadable, no one can access the app.
		var allowedEmails []string
		configDoc, err := firestoreClient.Collection("config").Doc("auth").Get(ctx)
		if err != nil {
			log.Fatalf("failed to read config/auth from Firestore: %v (no users will be allowed without this document)", err)
		}
		if emails, ok := configDoc.Data()["allowed_emails"].([]interface{}); ok {
			for _, e := range emails {
				if s, ok := e.(string); ok {
					allowedEmails = append(allowedEmails, s)
				}
			}
		}
		if len(allowedEmails) == 0 {
			log.Fatalf("config/auth has no allowed_emails configured — refusing to start")
		}
		log.Printf("Loaded %d allowed email(s) from Firestore", len(allowedEmails))

		// Read app config from Firestore (config/app document)
		appConfigDoc, err := firestoreClient.Collection("config").Doc("app").Get(ctx)
		if err != nil {
			log.Printf("config/app not found in Firestore, using defaults (MaxPokemonID=%d, DefaultExcluded=%v)", service.MaxPokemonID, service.DefaultExcludedPokemonIDs)
		} else {
			if maxID, ok := appConfigDoc.Data()["max_pokemon_id"].(int64); ok {
				service.MaxPokemonID = int(maxID)
				log.Printf("Loaded MaxPokemonID=%d from Firestore", service.MaxPokemonID)
			}
			if ids, ok := appConfigDoc.Data()["default_excluded_pokemon_ids"].([]interface{}); ok {
				excluded := make([]int, 0, len(ids))
				for _, v := range ids {
					if id, ok := v.(int64); ok {
						excluded = append(excluded, int(id))
					}
				}
				service.DefaultExcludedPokemonIDs = excluded
				log.Printf("Loaded %d default excluded Pokemon IDs from Firestore", len(excluded))
			}
		}

		pokemonFetcher = service.NewPokeAPIService()
		aiScorer = service.NewGeminiService(geminiClient)
		userPokemonRepo = repository.NewUserPokemonRepo(firestoreClient)
		userSettingsRepo = repository.NewUserSettingsRepo(firestoreClient)
		authMiddleware = middleware.FirebaseAuth(authClient, allowedEmails)
	}

	// Wire up dependencies (all services receive interfaces, not concrete types)
	questService := service.NewQuestService(pokemonFetcher, aiScorer, userSettingsRepo)
	collectionService := service.NewCollectionService(userPokemonRepo, pokemonFetcher)

	questHandler := handler.NewQuestHandler(questService, userPokemonRepo, aiScorer)
	collectionHandler := handler.NewCollectionHandler(collectionService, userSettingsRepo)
	settingsHandler := handler.NewSettingsHandler(userSettingsRepo)

	// Setup and run
	r := router.Setup(authMiddleware, questHandler, collectionHandler, settingsHandler, cfg.FrontendURL)

	log.Printf("Starting server on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
