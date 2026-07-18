import type { QuestTuningConfig } from "../service/quest-service.js";

/** 本番の既定値 (mock モードの env 未設定時の値) と同じチューニング値。 */
export const DEFAULT_QUEST_TUNING: QuestTuningConfig = {
  fuzzyMatchMinNameLength: 4,
  fuzzyMatchMaxDistance: 2,
  ballCaptureBonus: { poke: 0, great: 1.5, ultra: 3.0 },
  legendaryEncounterRate: 0.01,
  locationChoiceCount: 4,
  masterBallMinScore: 70,
};
