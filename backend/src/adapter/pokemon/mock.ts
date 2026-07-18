import type { PokemonClient } from "../../domain/ports.js";
import type { Pokemon, PokemonRecord } from "../../domain/pokemon.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";
import { buildSpriteURL } from "./sprite-url.js";

const mockPokemon: PokemonRecord[] = [
  {
    id: 25, name_en: "Pikachu", name_ja: "ピカチュウ",
    description_en: "When several of these Pokemon gather, their electricity could build and cause lightning storms.",
    description_ja: "何匹か 集まると そこに 激しい 雷が 落ちることがある。",
    base_stat_total: 320, types: ["electric"], height: 4, weight: 60, is_legendary: false, is_mythical: false,
    hint_moves: ["しっぽをふる", "なきごえ", "でんきショック"],
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
    base_stat_total: 318, types: ["grass", "poison"], height: 7, weight: 69, is_legendary: false, is_mythical: false,
    hint_moves: ["たいあたり", "なきごえ", "つるのムチ"],
    flavor_texts: [
      { version_names: ["X"], description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokemon.", description_ja: "生まれたときから 背中に 不思議な タネが 植えてあって 体と ともに 育つという。" },
      { version_names: ["サン"], description_en: "For some time after its birth, it grows by gaining nourishment from the seed on its back.", description_ja: "生まれてから しばらくの あいだは 背中の タネから 栄養を もらって 大きく 育つ。" },
    ],
  },
  {
    id: 4, name_en: "Charmander", name_ja: "ヒトカゲ",
    description_en: "Obviously prefers hot places. When it rains, steam is said to spout from the tip of its tail.",
    description_ja: "暑い ところが 好き。雨に 濡れると しっぽの 先から 煙が 出るという。",
    base_stat_total: 309, types: ["fire"], height: 6, weight: 85, is_legendary: false, is_mythical: false,
    hint_moves: ["ひっかく", "なきごえ", "ひのこ"],
    flavor_texts: [
      { version_names: ["X"], description_en: "The flame that burns at the tip of its tail is an indication of its emotions. The flame wavers when Charmander is enjoying itself. If the Pokemon becomes enraged, the flame burns fiercely.", description_ja: "しっぽの 炎は 気分を あらわす。楽しい ときには ゆらゆら 炎が 揺れて 怒った ときには めらめら 激しく 燃える。" },
      { version_names: ["ソード"], description_en: "It has a preference for hot things. When it rains, steam is said to spout from the tip of its tail.", description_ja: "暑い ものが 好き。雨に 濡れると しっぽの 先から けむりが 出るという。" },
    ],
  },
  {
    id: 7, name_en: "Squirtle", name_ja: "ゼニガメ",
    description_en: "After birth, its back swells and hardens into a shell. Powerfully sprays foam from its mouth.",
    description_ja: "生まれた あとに 背中が 膨れて 硬い 甲羅が できる。口から 勢いよく 泡を 吹く。",
    base_stat_total: 314, types: ["water"], height: 5, weight: 90, is_legendary: false, is_mythical: false,
    hint_moves: ["たいあたり", "しっぽをふる", "みずでっぽう"],
    flavor_texts: [
      { version_names: ["X"], description_en: "Squirtle's shell is not merely used for protection. The shell's rounded shape and the grooves on its surface help minimize resistance in water, enabling this Pokemon to swim at high speeds.", description_ja: "ただの 甲羅では ない。丸い 形と 表面の 溝は 水の 抵抗を 減らす 構造。速い スピードで 泳ぐ。" },
      { version_names: ["サン"], description_en: "When it retracts its long neck into its shell, it squirts out water with vigorous force.", description_ja: "長い 首を 甲羅に 引っ込める ときに 勢い よく 水を 噴き出す。" },
    ],
  },
  {
    id: 150, name_en: "Mewtwo", name_ja: "ミュウツー",
    description_en: "It was created by a scientist after years of horrific gene-splicing and DNA-engineering experiments.",
    description_ja: "遺伝子を 組み替えて 作られた ポケモン。人間の 科学力で 体は 作れても やさしい 心を 作ることは できなかった。",
    base_stat_total: 680, types: ["psychic"], height: 20, weight: 1220, is_legendary: true, is_mythical: false,
    hint_moves: ["かなしばり", "ねんりき", "スピードスター"],
    flavor_texts: [
      { version_names: ["X"], description_en: "It was created by a scientist after years of horrific gene-splicing and DNA-engineering experiments.", description_ja: "遺伝子を 組み替えて 作られた ポケモン。人間の 科学力で 体は 作れても やさしい 心を 作ることは できなかった。" },
      { version_names: ["ソード"], description_en: "A Pokémon that was created by genetic manipulation. However, even though the scientific power of humans made its body, they failed to give it a warm heart.", description_ja: "遺伝子 操作に よって つくられた ポケモン。人間の 科学力で 体は つくれても 優しい 心を つくることは できなかった。" },
    ],
  },
  {
    id: 445, name_en: "Garchomp", name_ja: "ガブリアス",
    description_en: "When it folds up its body and extends its wings, it looks like a jet plane. It loves to fly at supersonic speeds.",
    description_ja: "体を 折りたたみ 翼を 広げると ジェット機の ような 姿に なる。音速で 飛ぶのが 大好き。",
    base_stat_total: 600, types: ["dragon", "ground"], height: 19, weight: 950, is_legendary: false, is_mythical: false,
    hint_moves: ["かみくだく", "すなかけ", "たいあたり"],
    flavor_texts: [
      { version_names: ["X"], description_en: "When it folds up its body and extends its wings, it looks like a jet plane. It loves to fly at supersonic speeds.", description_ja: "体を 折りたたみ 翼を 広げると ジェット機の ような 姿に なる。音速で 飛ぶのが 大好き。" },
      { version_names: ["ソード"], description_en: "It flies at speeds equal to a jet fighter. It never allows its prey to escape.", description_ja: "戦闘機 なみの スピードで 飛ぶ。獲物を 決して 逃がさない。" },
    ],
  },
];

/** 固定リストの図鑑番号 (リスト順)。抽選はサービス側がこの一覧と許可 ID を突き合わせて行う。 */
const MOCK_POKEMON_IDS: readonly number[] = mockPokemon.map((p) => p.id);

/** 外部依存を呼ばずに固定リストから返す開発用 PokemonClient 実装。抽選ロジックは持たず、データ提供のみを担う。 */
export class MockPokemonClient implements PokemonClient {
  /**
   * このデータソースが取得できる図鑑番号の一覧 (固定リスト順)。
   * @returns 図鑑番号の配列。
   */
  getServableIDs(): readonly number[] {
    return MOCK_POKEMON_IDS;
  }

  /**
   * @param id ポケモン ID。
   * @returns 該当ポケモン。sprite_url は図鑑番号から組み立てて付与する。
   * @throws 固定リストに存在しない場合。
   */
  async getPokemonByID(id: number): Promise<Pokemon> {
    const found = mockPokemon.find((p) => p.id === id);
    if (!found) throw new Error(`mock pokemon not found: ${id}`);
    return { ...found, sprite_url: buildSpriteURL(found.id) };
  }

  /**
   * 指定タイプを持つ固定リストのポケモンの図鑑番号を返す。
   * @param type ポケモンのタイプ。
   * @returns 該当する図鑑番号の配列。
   */
  async getIDsByType(type: PokemonType): Promise<readonly number[]> {
    return mockPokemon.filter((p) => p.types.includes(type)).map((p) => p.id);
  }
}
