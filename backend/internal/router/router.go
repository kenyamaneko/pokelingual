package router

import (
	"github.com/gin-gonic/gin"
	"github.com/kenyamamoto/pokelingual/backend/internal/handler"
	"github.com/kenyamamoto/pokelingual/backend/internal/middleware"
)

// Setup creates and configures the Gin router with all API routes and middleware.
func Setup(
	authMiddleware gin.HandlerFunc,
	questHandler *handler.QuestHandler,
	collectionHandler *handler.CollectionHandler,
	settingsHandler *handler.SettingsHandler,
	frontendURL string,
) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CorsConfig(frontendURL))

	api := r.Group("/api")
	api.Use(authMiddleware)
	{
		quest := api.Group("/quest")
		{
			quest.GET("/new", questHandler.NewQuest)
			quest.POST("/score", questHandler.ScoreTranslation)
			quest.POST("/guess-name", questHandler.GuessName)
			quest.POST("/capture", questHandler.AttemptCapture)
			quest.POST("/chat", questHandler.Chat)
		}

		collection := api.Group("/collection")
		{
			collection.GET("", collectionHandler.GetCollection)
			collection.GET("/:id", collectionHandler.GetPokemonDetail)
		}

		settings := api.Group("/settings")
		{
			settings.GET("", settingsHandler.GetSettings)
			settings.PUT("/excluded-pokemon", settingsHandler.UpdateExcludedPokemon)
		}
	}

	return r
}
