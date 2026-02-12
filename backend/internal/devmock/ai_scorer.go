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
	return &model.ScoreResult{Score: score, Comment: mockComment(score)}, nil
}

func mockComment(score float64) string {
	switch {
	case score >= 90:
		return "素晴らしい 翻訳だ！"
	case score >= 70:
		return "なかなか いい 翻訳だ！"
	case score >= 50:
		return "もう 少し がんばろう！"
	case score >= 30:
		return "大事な 部分が 抜けているぞ"
	default:
		return "意味が 大きく ずれているぞ"
	}
}
