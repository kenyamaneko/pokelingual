package main

import (
	"context"
	"log"

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

	var pokemonFetcher domain.PokemonFetcher
	var aiScorer domain.AIScorer
	var userPokemonRepo domain.UserPokemonRepository
	var userSettingsRepo domain.UserSettingsRepository
	var authMiddleware gin.HandlerFunc

	if cfg.AppMode == "dev" {
		log.Println("Starting in dev mode with mock services")
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
		defer firestoreClient.Close()

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

		pokemonFetcher = service.NewPokeAPIService()
		aiScorer = service.NewGeminiService(geminiClient)
		userPokemonRepo = repository.NewUserPokemonRepo(firestoreClient)
		userSettingsRepo = repository.NewUserSettingsRepo(firestoreClient)
		authMiddleware = middleware.FirebaseAuth(authClient, allowedEmails)
	}

	// Wire up dependencies (all services receive interfaces, not concrete types)
	questService := service.NewQuestService(pokemonFetcher, aiScorer, userSettingsRepo)
	collectionService := service.NewCollectionService(userPokemonRepo, pokemonFetcher)

	questHandler := handler.NewQuestHandler(questService, userPokemonRepo)
	collectionHandler := handler.NewCollectionHandler(collectionService, userSettingsRepo)
	settingsHandler := handler.NewSettingsHandler(userSettingsRepo)

	// Setup and run
	r := router.Setup(authMiddleware, questHandler, collectionHandler, settingsHandler, cfg.FrontendURL)

	log.Printf("Starting server on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
