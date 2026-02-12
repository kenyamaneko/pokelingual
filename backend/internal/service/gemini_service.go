package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
	"google.golang.org/genai"
)

// GeminiService implements domain.AIScorer using Google's Gemini API.
type GeminiService struct {
	client *genai.Client
	model  string
}

// NewGeminiService creates a new GeminiService with the given client.
func NewGeminiService(client *genai.Client) *GeminiService {
	return &GeminiService{
		client: client,
		model:  "gemini-2.5-flash",
	}
}

// ScoreTranslation evaluates a Japanese translation of the given English text using Gemini.
func (s *GeminiService) ScoreTranslation(ctx context.Context, englishText, japaneseTranslation string) (*model.ScoreResult, error) {
	prompt := fmt.Sprintf(`You are an English-to-Japanese translation evaluator for a language learning app.

Original English text:
"%s"

User's Japanese translation:
"%s"

Evaluate the translation and respond in EXACTLY this JSON format:
{
  "score": <integer 0-100>,
  "comment": "<one short review sentence in Japanese>"
}

Scoring guidelines:
- 90-100: Accurate meaning, natural Japanese, minor issues at most
- 70-89: Core meaning preserved, some awkward phrasing or minor errors
- 50-69: Partially correct, missing important nuances or grammatical issues
- 30-49: Significant errors but some understanding shown
- 0-29: Major misunderstanding or mostly incorrect

Comment guidelines:
- One short sentence in Japanese reviewing the translation
- Use simple kanji with spaces between words (e.g. "意味は 合っているが 表現が 少し 不自然だ")
- Keep it under 30 characters
- Match the tone of Pokemon game text

Respond with ONLY the JSON, no other text.`, englishText, japaneseTranslation)

	result, err := s.client.Models.GenerateContent(ctx, s.model, genai.Text(prompt), nil)
	if err != nil {
		return nil, fmt.Errorf("gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	text := result.Text()
	text = stripCodeFences(text)

	var scoreResult model.ScoreResult
	if err := json.Unmarshal([]byte(text), &scoreResult); err != nil {
		return nil, fmt.Errorf("parsing gemini response: %w (raw: %s)", err, text)
	}

	if scoreResult.Score < 0 {
		scoreResult.Score = 0
	}
	if scoreResult.Score > 100 {
		scoreResult.Score = 100
	}

	return &scoreResult, nil
}

func stripCodeFences(text string) string {
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```json") {
		text = strings.TrimPrefix(text, "```json")
	} else if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```")
	}
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text)
}
