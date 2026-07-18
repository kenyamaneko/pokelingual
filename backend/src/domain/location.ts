import type { QuestLocation } from "../../../shared/api-types/quest.js";
import type { RandomSource } from "./ports.js";
import { pickRandomSample } from "./random.js";

/**
 * 探索場所の定義 (SSoT)。全10か所で全18タイプをそれぞれ2か所ずつカバーする。
 * 場所を選ぶと、そのタイプのいずれかを持つポケモンが出題される。
 */
export const QUEST_LOCATIONS: readonly QuestLocation[] = [
  { id: "rocky-mountain", name: "ゴツゴツの岩山", description: "ごつごつした岩肌と土けむり。力自慢が集まる", types: ["rock", "ground", "fighting", "bug"] },
  { id: "snowy-mountain", name: "険しい雪山", description: "吹雪の向こうに、何かの気配", types: ["ice", "dragon", "ghost"] },
  { id: "ruined-powerplant", name: "廃墟の発電所", description: "錆びた機械が、まだ帯電している", types: ["electric", "steel", "poison"] },
  { id: "sunlit-forest", name: "木漏れ日の森", description: "やわらかい光と、虫の声", types: ["grass", "bug", "fairy", "normal"] },
  { id: "blazing-volcano", name: "灼熱の火山", description: "煮えたぎるマグマと、立ちのぼる熱気", types: ["fire", "ground", "steel", "poison"] },
  { id: "wide-lake", name: "広い湖のほとり", description: "水面をわたる風と、羽ばたきの音", types: ["water", "flying", "psychic", "normal"] },
  { id: "old-ruins", name: "古びた遺跡", description: "静寂と、どこからかの視線", types: ["psychic", "dark", "ghost"] },
  { id: "sky-cliff", name: "大空の断崖", description: "風が吹き抜ける断崖。雲を裂いて飛ぶ影がある", types: ["flying", "dragon", "fire", "grass"] },
  { id: "night-cove", name: "夜の入江", description: "月あかりに揺れる水面。潮の香りと、闇の気配", types: ["water", "dark", "fighting"] },
  { id: "crystal-cave", name: "きらめく水晶の洞窟", description: "無数の水晶がきらめき、時おりパチッと火花が散る", types: ["rock", "ice", "electric", "fairy"] },
];

/**
 * 場所 ID から場所定義を返す。
 * @param id 場所 ID。
 * @returns 該当する場所。存在しなければ undefined。
 */
export function findLocation(id: string): QuestLocation | undefined {
  return QUEST_LOCATIONS.find((l) => l.id === id);
}

/**
 * 全場所からランダムに、指定された数の場所を重複なく選ぶ。
 * @param random 乱数ソース。
 * @param count 選ぶ場所の数。
 * @returns ランダムに選ばれた場所の配列。
 */
export function pickRandomLocations(random: RandomSource, count: number): QuestLocation[] {
  return pickRandomSample(QUEST_LOCATIONS, count, random);
}
