package devmock

import (
	"context"
	"fmt"
	"math/rand"

	"github.com/kenyamamoto/pokelingual/backend/internal/model"
)

var mockPokemon = []model.Pokemon{
	{
		ID:            25,
		NameEN:        "Pikachu",
		NameJA:        "ピカチュウ",
		DescriptionEN: "When several of these Pokemon gather, their electricity could build and cause lightning storms.",
		DescriptionJA: "何匹か 集まると そこに 激しい 雷が 落ちることがある。",
		SpriteURL:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
		BaseStatTotal: 320,
		Types:         []string{"electric"},
		Height:        4,
		Weight:        60,
		FlavorTexts: []model.FlavorTextPair{
			{VersionNames: []string{"X"}, DescriptionEN: "It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.", DescriptionJA: "尻尾を 立てて まわりの 様子を うかがう。尻尾に 雷が 落ちることが よくある。"},
			{VersionNames: []string{"サン"}, DescriptionEN: "A plan was recently announced to gather many Pikachu and generate electricity.", DescriptionJA: "たくさんの ピカチュウを 集めて 発電所を 作る 計画が 最近 発表された。"},
			{VersionNames: []string{"ソード"}, DescriptionEN: "When it smashes its opponents with its bolt-shaped tail, it delivers a surge of electricity equivalent to a lightning strike.", DescriptionJA: "つくる 電気が 強力な ピカチュウは いなずまの 形の しっぽで アースして 過充電を 防ぐ。"},
		},
	},
	{
		ID:            1,
		NameEN:        "Bulbasaur",
		NameJA:        "フシギダネ",
		DescriptionEN: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokemon.",
		DescriptionJA: "生まれたときから 背中に 不思議な タネが 植えてあって 体と ともに 育つという。",
		SpriteURL:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
		BaseStatTotal: 318,
		Types:         []string{"grass", "poison"},
		Height:        7,
		Weight:        69,
		FlavorTexts: []model.FlavorTextPair{
			{VersionNames: []string{"X"}, DescriptionEN: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokemon.", DescriptionJA: "生まれたときから 背中に 不思議な タネが 植えてあって 体と ともに 育つという。"},
			{VersionNames: []string{"サン"}, DescriptionEN: "For some time after its birth, it grows by gaining nourishment from the seed on its back.", DescriptionJA: "生まれてから しばらくの あいだは 背中の タネから 栄養を もらって 大きく 育つ。"},
		},
	},
	{
		ID:            4,
		NameEN:        "Charmander",
		NameJA:        "ヒトカゲ",
		DescriptionEN: "Obviously prefers hot places. When it rains, steam is said to spout from the tip of its tail.",
		DescriptionJA: "暑い ところが 好き。雨に 濡れると しっぽの 先から 煙が 出るという。",
		SpriteURL:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png",
		BaseStatTotal: 309,
		Types:         []string{"fire"},
		Height:        6,
		Weight:        85,
		FlavorTexts: []model.FlavorTextPair{
			{VersionNames: []string{"X"}, DescriptionEN: "The flame that burns at the tip of its tail is an indication of its emotions. The flame wavers when Charmander is enjoying itself. If the Pokemon becomes enraged, the flame burns fiercely.", DescriptionJA: "しっぽの 炎は 気分を あらわす。楽しい ときには ゆらゆら 炎が 揺れて 怒った ときには めらめら 激しく 燃える。"},
			{VersionNames: []string{"ソード"}, DescriptionEN: "It has a preference for hot things. When it rains, steam is said to spout from the tip of its tail.", DescriptionJA: "暑い ものが 好き。雨に 濡れると しっぽの 先から けむりが 出るという。"},
		},
	},
	{
		ID:            7,
		NameEN:        "Squirtle",
		NameJA:        "ゼニガメ",
		DescriptionEN: "After birth, its back swells and hardens into a shell. Powerfully sprays foam from its mouth.",
		DescriptionJA: "生まれた あとに 背中が 膨れて 硬い 甲羅が できる。口から 勢いよく 泡を 吹く。",
		SpriteURL:     "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png",
		BaseStatTotal: 314,
		Types:         []string{"water"},
		Height:        5,
		Weight:        90,
		FlavorTexts: []model.FlavorTextPair{
			{VersionNames: []string{"X"}, DescriptionEN: "Squirtle's shell is not merely used for protection. The shell's rounded shape and the grooves on its surface help minimize resistance in water, enabling this Pokemon to swim at high speeds.", DescriptionJA: "ただの 甲羅では ない。丸い 形と 表面の 溝は 水の 抵抗を 減らす 構造。速い スピードで 泳ぐ。"},
			{VersionNames: []string{"サン"}, DescriptionEN: "When it retracts its long neck into its shell, it squirts out water with vigorous force.", DescriptionJA: "長い 首を 甲羅に 引っ込める ときに 勢い よく 水を 噴き出す。"},
		},
	},
}

// PokemonFetcher implements domain.PokemonFetcher with hardcoded Pokemon data.
type PokemonFetcher struct{}

// NewPokemonFetcher creates a new mock PokemonFetcher.
func NewPokemonFetcher() *PokemonFetcher {
	return &PokemonFetcher{}
}

// GetRandomPokemon returns a random Pokemon from the hardcoded list.
func (f *PokemonFetcher) GetRandomPokemon(ctx context.Context) (*model.Pokemon, error) {
	p := mockPokemon[rand.Intn(len(mockPokemon))]
	return &p, nil
}

// GetPokemonByID returns a Pokemon by ID from the hardcoded list.
func (f *PokemonFetcher) GetPokemonByID(ctx context.Context, id int) (*model.Pokemon, error) {
	for _, p := range mockPokemon {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("mock pokemon not found: %d", id)
}
