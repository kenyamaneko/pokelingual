import type { PokemonClient, RandomSource } from "../../domain/ports.js";
import type { Pokemon } from "../../domain/pokemon.js";

const mockPokemon: Pokemon[] = [
  {
    id: 25, name_en: "Pikachu", name_ja: "ピカチュウ",
    description_en: "When several of these Pokemon gather, their electricity could build and cause lightning storms.",
    description_ja: "何匹か 集まると そこに 激しい 雷が 落ちることがある。",
    sprite_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    base_stat_total: 320, types: ["electric"], height: 4, weight: 60, is_legendary: false, is_mythical: false,
    flavor_texts: [
      { version_names: ["X"], description_en: "It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.", description_ja: "尻尾を 立てて まわりの 様子を うかがう。尻尾に 雷が 落ちることが よくある。" },
      { version_names: ["サン"], description_en: "A plan was recently announced to gather many Pikachu and generate electricity.", description_ja: "たくさんの ピカチュウを 集めて 発電所を 作る 計画が 最近 発表された。" },
      { version_names: ["ソード"], description_en: "When it smashes its opponents with its bolt-shaped tail, it delivers a surge of electricity equivalent to a lightning strike.", description_ja: "つくる 電気が 強力な ピカチュウは いなずまの 形の しっぽで アースして 過充電を 防ぐ。" },
    ],
  },
  {
    id: 1, name_en: "Bulbasaur", name_ja: "フシギダネ",
    description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokemon.",
    description_ja: "生まれたときから 背中に 不思議な タネが 植えてあって 体と ともに 育つという。",
    sprite_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
    base_stat_total: 318, types: ["grass", "poison"], height: 7, weight: 69, is_legendary: false, is_mythical: false,
    flavor_texts: [
      { version_names: ["X"], description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokemon.", description_ja: "生まれたときから 背中に 不思議な タネが 植えてあって 体と ともに 育つという。" },
      { version_names: ["サン"], description_en: "For some time after its birth, it grows by gaining nourishment from the seed on its back.", description_ja: "生まれてから しばらくの あいだは 背中の タネから 栄養を もらって 大きく 育つ。" },
    ],
  },
  {
    id: 4, name_en: "Charmander", name_ja: "ヒトカゲ",
    description_en: "Obviously prefers hot places. When it rains, steam is said to spout from the tip of its tail.",
    description_ja: "暑い ところが 好き。雨に 濡れると しっぽの 先から 煙が 出るという。",
    sprite_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png",
    base_stat_total: 309, types: ["fire"], height: 6, weight: 85, is_legendary: false, is_mythical: false,
    flavor_texts: [
      { version_names: ["X"], description_en: "The flame that burns at the tip of its tail is an indication of its emotions. The flame wavers when Charmander is enjoying itself. If the Pokemon becomes enraged, the flame burns fiercely.", description_ja: "しっぽの 炎は 気分を あらわす。楽しい ときには ゆらゆら 炎が 揺れて 怒った ときには めらめら 激しく 燃える。" },
      { version_names: ["ソード"], description_en: "It has a preference for hot things. When it rains, steam is said to spout from the tip of its tail.", description_ja: "暑い ものが 好き。雨に 濡れると しっぽの 先から けむりが 出るという。" },
    ],
  },
  {
    id: 7, name_en: "Squirtle", name_ja: "ゼニガメ",
    description_en: "After birth, its back swells and hardens into a shell. Powerfully sprays foam from its mouth.",
    description_ja: "生まれた あとに 背中が 膨れて 硬い 甲羅が できる。口から 勢いよく 泡を 吹く。",
    sprite_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png",
    base_stat_total: 314, types: ["water"], height: 5, weight: 90, is_legendary: false, is_mythical: false,
    flavor_texts: [
      { version_names: ["X"], description_en: "Squirtle's shell is not merely used for protection. The shell's rounded shape and the grooves on its surface help minimize resistance in water, enabling this Pokemon to swim at high speeds.", description_ja: "ただの 甲羅では ない。丸い 形と 表面の 溝は 水の 抵抗を 減らす 構造。速い スピードで 泳ぐ。" },
      { version_names: ["サン"], description_en: "When it retracts its long neck into its shell, it squirts out water with vigorous force.", description_ja: "長い 首を 甲羅に 引っ込める ときに 勢い よく 水を 噴き出す。" },
    ],
  },
  {
    id: 150, name_en: "Mewtwo", name_ja: "ミュウツー",
    description_en: "It was created by a scientist after years of horrific gene-splicing and DNA-engineering experiments.",
    description_ja: "遺伝子を 組み替えて 作られた ポケモン。人間の 科学力で 体は 作れても やさしい 心を 作ることは できなかった。",
    sprite_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
    base_stat_total: 680, types: ["psychic"], height: 20, weight: 1220, is_legendary: true, is_mythical: false,
    flavor_texts: [
      { version_names: ["X"], description_en: "It was created by a scientist after years of horrific gene-splicing and DNA-engineering experiments.", description_ja: "遺伝子を 組み替えて 作られた ポケモン。人間の 科学力で 体は 作れても やさしい 心を 作ることは できなかった。" },
      { version_names: ["ソード"], description_en: "A Pokémon that was created by genetic manipulation. However, even though the scientific power of humans made its body, they failed to give it a warm heart.", description_ja: "遺伝子 操作に よって つくられた ポケモン。人間の 科学力で 体は つくれても 優しい 心を つくることは できなかった。" },
    ],
  },
];

/** PokeAPI を呼ばずに固定リストから返す開発用 PokemonClient 実装。 */
export class MockPokemonClient implements PokemonClient {
  /**
   * @param random 乱数ソース。MockRandomSource を渡すと毎回同じポケモンが出題され、e2e が同じ結果を再現できる。
   */
  constructor(private random: RandomSource) {}

  /**
   * @returns 乱数ソースで選んだ固定リストのポケモン。
   */
  async getRandomPokemon(): Promise<Pokemon> {
    return { ...mockPokemon[Math.floor(this.random.next() * mockPokemon.length)] };
  }

  /**
   * @param id ポケモン ID。
   * @returns 該当ポケモン。
   * @throws 固定リストに存在しない場合。
   */
  async getPokemonByID(id: number): Promise<Pokemon> {
    const found = mockPokemon.find((p) => p.id === id);
    if (!found) throw new Error(`mock pokemon not found: ${id}`);
    return { ...found };
  }
}
