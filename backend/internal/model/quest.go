package model

// QuestSession holds the in-memory state for an active quest.
type QuestSession struct {
	PokemonID     int     `json:"pokemon_id"`
	DescriptionEN string  `json:"description_en"`
	DescriptionJA string  `json:"-"`
	NameEN        string  `json:"-"`
	NameJA        string  `json:"-"`
	SpriteURL     string  `json:"-"`
	BaseStatTotal int      `json:"-"`
	Types         []string `json:"-"`
	Height        int      `json:"-"`
	Weight        int      `json:"-"`
	IsLegendary   bool     `json:"-"`
	IsMythical    bool     `json:"-"`
	Score         float64  `json:"score,omitempty"`
	BallType      string  `json:"ball_type,omitempty"`
	GuessAttempts int     `json:"guess_attempts,omitempty"`
	NameGuessed   bool    `json:"-"`
}

// ScoreResult is the AI-agnostic result of a translation scoring.
type ScoreResult struct {
	Score   float64 `json:"score"`
	Review  string  `json:"review"`
}

// ChatMessage represents a single message in the professor chat.
type ChatMessage struct {
	Role    string `json:"role"`    // "user" or "professor"
	Content string `json:"content"`
}

// ChatContext holds the quest context needed for the professor chat.
type ChatContext struct {
	DescriptionEN string  `json:"description_en"`
	DescriptionJA string  `json:"description_ja"`
	Translation   string  `json:"translation"`
	Score         float64 `json:"score"`
	Review        string  `json:"review"`
	NameEN        string  `json:"name_en"`
	NameJA        string  `json:"name_ja"`
}
