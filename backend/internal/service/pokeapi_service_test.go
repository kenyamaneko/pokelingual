package service

import (
	"testing"
)

// Given: various flavor texts with control characters
// When: cleanFlavorText is applied
// Then: returns cleaned, single-line text
func TestCleanFlavorText(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "removes form feed characters",
			input:    "It stores static\felectricity in its\fbody.",
			expected: "It stores static electricity in its body.",
		},
		{
			name:     "removes newlines",
			input:    "A strange seed was\nplanted on its\nback at birth.",
			expected: "A strange seed was planted on its back at birth.",
		},
		{
			name:     "removes carriage returns",
			input:    "A strange seed\r\nwas planted.",
			expected: "A strange seed was planted.",
		},
		{
			name:     "collapses multiple spaces",
			input:    "A  very   long    text.",
			expected: "A very long text.",
		},
		{
			name:     "trims whitespace",
			input:    "  hello world  ",
			expected: "hello world",
		},
		{
			name:     "handles mixed control characters",
			input:    "When several of\nthese POKéMON\fgather, their\felectricity could\nbuild and cause\nlightning storms.",
			expected: "When several of these POKéMON gather, their electricity could build and cause lightning storms.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cleanFlavorText(tt.input)
			if got != tt.expected {
				t.Errorf("cleanFlavorText(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
