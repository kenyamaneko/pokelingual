package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds the application configuration loaded from environment variables.
type Config struct {
	AppMode                 string
	Port                    string
	FirebaseCredentialsPath string
	GeminiAPIKey            string
	FrontendURL             string
}

// Load reads environment variables and returns the application configuration.
func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		AppMode:                 getEnv("APP_MODE", "dev"),
		Port:                    getEnv("PORT", "8080"),
		FirebaseCredentialsPath: getEnv("FIREBASE_CREDENTIALS_PATH", ""),
		GeminiAPIKey:            getEnv("GEMINI_API_KEY", ""),
		FrontendURL:             getEnv("FRONTEND_URL", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
