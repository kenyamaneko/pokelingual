package model

// QuestSession holds the in-memory state for an active quest.
type QuestSession struct {
	PokemonID      int     `json:"pokemon_id"`
	DescriptionEN  string  `json:"description_en"`
	DescriptionJA  string  `json:"-"`
	NameEN         string  `json:"-"`
	NameJA         string  `json:"-"`
	SpriteURL      string  `json:"-"`
	Score          float64 `json:"score,omitempty"`
	NameMultiplier float64 `json:"name_multiplier,omitempty"`
	GuessAttempts  int     `json:"guess_attempts,omitempty"`
	WrongGuesses   int     `json:"wrong_guesses,omitempty"`
	NameGuessed    bool    `json:"-"`
}

// ScoreResult is the AI-agnostic result of a translation scoring.
type ScoreResult struct {
	Score float64 `json:"score"`
}
