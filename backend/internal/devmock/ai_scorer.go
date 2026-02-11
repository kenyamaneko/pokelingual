package devmock

import (
	"context"
	"math/rand"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

// AIScorer implements domain.AIScorer with random scores.
type AIScorer struct{}

// NewAIScorer creates a new mock AIScorer.
func NewAIScorer() *AIScorer {
	return &AIScorer{}
}

// ScoreTranslation returns a random score between 20 and 95.
func (s *AIScorer) ScoreTranslation(ctx context.Context, englishText, japaneseTranslation string) (*model.ScoreResult, error) {
	score := float64(20 + rand.Intn(76))
	return &model.ScoreResult{Score: score}, nil
}
