package service

import (
	"testing"
)

// Given: Gemini responses that may include markdown code fences
// When: stripCodeFences is applied
// Then: returns raw JSON content
func TestStripCodeFences(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "strips json code fence",
			input:    "```json\n{\"score\": 85}\n```",
			expected: "{\"score\": 85}",
		},
		{
			name:     "strips plain code fence",
			input:    "```\n{\"score\": 85}\n```",
			expected: "{\"score\": 85}",
		},
		{
			name:     "no code fence",
			input:    "{\"score\": 85}",
			expected: "{\"score\": 85}",
		},
		{
			name:     "preserves inner content",
			input:    "```json\n{\"score\": 85, \"feedback_ja\": \"よくできました\"}\n```",
			expected: "{\"score\": 85, \"feedback_ja\": \"よくできました\"}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := stripCodeFences(tt.input)
			if got != tt.expected {
				t.Errorf("stripCodeFences(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
