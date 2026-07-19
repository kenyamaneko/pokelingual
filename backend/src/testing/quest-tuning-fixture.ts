import type { QuestTuningConfig } from "../service/quest-service.js";

// 値は本番の既定値と一致するが、.env.tuning からは読み込まず独立して定義する。
// 運用チューニングの変更がテストの前提に波及しないようにするため。
/** テスト用のチューニング値。 */
export const DEFAULT_QUEST_TUNING: QuestTuningConfig = {
  fuzzyMatchMinNameLength: 4,
  fuzzyMatchMaxDistance: 2,
  ballCaptureBonus: { poke: 0, great: 1.5, ultra: 3.0 },
  legendaryEncounterRate: 0.01,
  locationChoiceCount: 4,
  masterBallMinScore: 70,
};
