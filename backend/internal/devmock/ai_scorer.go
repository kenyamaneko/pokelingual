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
	return &model.ScoreResult{Score: score, Review: mockReview(score)}, nil
}

func mockReview(score float64) string {
	switch {
	case score >= 90:
		return "全体の 意味を 正確に 捉えている。自然な 日本語で とても いい 翻訳だ！"
	case score >= 70:
		return "意味は よく 伝わっている。細かい ニュアンスを もう 少し 工夫すると さらに 良くなるぞ。"
	case score >= 50:
		return "前半は よく 訳せているが 後半の ニュアンスが 少し 惜しい。難しい 単語は 文脈から 推測してみよう。"
	case score >= 30:
		return "大事な 部分が 抜けているぞ。原文を もう一度 よく 読んで 全体の 意味を 掴もう。"
	default:
		return "意味が 大きく ずれている。まずは 知っている 単語を 手がかりに 全体像を つかんでみよう。"
	}
}
