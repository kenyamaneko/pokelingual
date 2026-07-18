import { ALL_GENERATIONS, validateEnabledGenerations } from "../domain/generation.js";
import type { EnabledGenerationsValidation } from "../domain/generation.js";
import { validateExcludedPokemonIDs } from "../domain/settings.js";
import type { ExcludedIDsValidation } from "../domain/settings.js";
import type { UserSettingsRepository } from "../domain/ports.js";
import type { SettingsResponse } from "../../../shared/api-types/settings.js";

/**
 * ユーザが除外指定できるポケモン数の上限。
 * Why: quest-service の出題抽選は除外比率が上がるとリトライ失敗の確率が上がる。
 * 図鑑が約 898 件ある前提で、除外がこの件数以下なら 10 回リトライで実質衝突しない (確率 < 1e-14)。
 */
const MAX_EXCLUDED_POKEMON_COUNT = 30;

/** ユーザ設定 (除外ポケモン・出題世代) のバリデーションと永続化を束ねるサービス。 */
export class SettingsService {
  /**
   * @param settingsRepo ユーザ設定リポジトリ。
   * @param servablePokemonIDs 供給可能な図鑑番号の集合。除外設定の妥当性検証に使う。
   */
  constructor(
    private settingsRepo: UserSettingsRepository,
    private servablePokemonIDs: ReadonlySet<number>,
  ) {}

  /**
   * ユーザ自身の設定を返す。
   * @param userId ユーザ ID。
   * @returns 除外ポケモンIDと出題対象世代。
   */
  async getSettings(userId: string): Promise<SettingsResponse> {
    const settings = await this.settingsRepo.getSettings(userId);
    // 設定画面はユーザー自身の除外だけを表示する (開発者除外はシステム側で透過的に適用)。
    // 世代は未設定なら全世代を返し、UI で全チェック状態にする。
    return {
      excluded_pokemon_ids: settings.excluded_pokemon_ids ?? [],
      enabled_generations: settings.enabled_generations ?? ALL_GENERATIONS,
    };
  }

  /**
   * 除外ポケモンIDリストをバリデーションし、成功時のみ永続化する。
   * @param userId ユーザ ID。
   * @param rawIDs リクエストで受け取った未バリデーションの値。
   * @returns 検証結果 (失敗時は永続化しない)。
   */
  async updateExcludedPokemon(userId: string, rawIDs: unknown): Promise<ExcludedIDsValidation> {
    const result = validateExcludedPokemonIDs(rawIDs, this.servablePokemonIDs, MAX_EXCLUDED_POKEMON_COUNT);
    if (!result.ok) return result;
    await this.settingsRepo.updateExcludedPokemon(userId, result.ids);
    return result;
  }

  /**
   * 出題対象の世代リストをバリデーションし、成功時のみ永続化する。
   * @param userId ユーザ ID。
   * @param rawGenerations リクエストで受け取った未バリデーションの値。
   * @returns 検証結果 (失敗時は永続化しない)。
   */
  async updateEnabledGenerations(userId: string, rawGenerations: unknown): Promise<EnabledGenerationsValidation> {
    const result = validateEnabledGenerations(rawGenerations);
    if (!result.ok) return result;
    await this.settingsRepo.updateEnabledGenerations(userId, result.generations);
    return result;
  }
}
