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
  "review": "<review in Japanese, 2-3 sentences>"
}

Scoring guidelines:
- 90-100: Accurate meaning, natural Japanese, minor issues at most
- 70-89: Core meaning preserved, some awkward phrasing or minor errors
- 50-69: Partially correct, missing important nuances or grammatical issues
- 30-49: Significant errors but some understanding shown
- 0-29: Major misunderstanding or mostly incorrect

Review guidelines:
- Write 2-3 short sentences in Japanese
- You are a kind, supportive Pokemon professor
- If the user left parts untranslated or omitted sections, understand they didn't know the meaning — they are NOT careless, they simply couldn't translate what they didn't understand. Guide them with explanations rather than pointing out "omissions"
- Include explanations of difficult English words/phrases (high school advanced level and above) that appear in the original text — briefly explain their meaning in Japanese
- Use simple kanji with spaces between words (e.g. "「friskily」は 元気よく 跳ね回る という 意味だよ。")
- End with a warm word of praise or encouragement, but vary the expression every time — never repeat the same closing phrase
- Keep the total review under 150 characters

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

// Chat generates a professor's response in a conversation about the quest.
func (s *GeminiService) Chat(ctx context.Context, chatCtx *model.ChatContext, messages []model.ChatMessage) (string, error) {
	var history strings.Builder
	for _, m := range messages {
		if m.Role == "user" {
			history.WriteString(fmt.Sprintf("User: %s\n", m.Content))
		} else {
			history.WriteString(fmt.Sprintf("Professor: %s\n", m.Content))
		}
	}

	prompt := fmt.Sprintf(`You are a Pokemon professor who is knowledgeable about both Pokemon and English.
You are chatting with a language learner who just completed a translation quest.

Quest context:
- Pokemon: %s (%s)
- Original English text: "%s"
- Japanese reference: "%s"
- User's translation: "%s"
- Score: %.0f/100
- Your earlier review: "%s"

Conversation so far:
%s
Respond to the user's latest message as the professor.

Guidelines:
- Respond in Japanese with simple kanji and spaces between words
- Be warm, encouraging, and helpful
- Answer questions about the English text, vocabulary, grammar, or the Pokemon
- Keep your response under 200 characters
- Do NOT use markdown formatting

Respond with ONLY your message, no prefix or label.`, chatCtx.NameEN, chatCtx.NameJA, chatCtx.DescriptionEN, chatCtx.DescriptionJA, chatCtx.Translation, chatCtx.Score, chatCtx.Review, history.String())

	result, err := s.client.Models.GenerateContent(ctx, s.model, genai.Text(prompt), nil)
	if err != nil {
		return "", fmt.Errorf("gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from gemini")
	}

	return strings.TrimSpace(result.Text()), nil
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
