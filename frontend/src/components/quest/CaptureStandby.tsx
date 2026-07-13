import type { BallType } from "../../../../shared/api-types/quest";
import { BALL_SPRITES, BALL_NAMES, captureUseButtonLabel } from "./ballAssets";

interface CaptureStandbyProps {
  ballType: BallType;
  onUse: () => void;
}

/**
 * 捕獲フェーズの待機画面。手に入れたボールを表示し、使用ボタンで捕獲演出へ進む。
 * @param props ballType / onUse を含む props。
 * @returns 捕獲待機 UI の要素。
 */
export function CaptureStandby({ ballType, onUse }: CaptureStandbyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <img
        src={BALL_SPRITES[ballType]}
        alt={BALL_NAMES[ballType]}
        className="w-24 h-24 animate-bounce mb-6"
      />
      <p className="text-gray-600 mb-6 text-lg">
        {BALL_NAMES[ballType]}を　手に　入れた！
      </p>
      <button
        onClick={onUse}
        className="bg-red-500 text-white py-4 px-12 rounded-2xl font-bold text-xl
                   hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl
                   active:scale-95 transform"
      >
        {captureUseButtonLabel(ballType)}
      </button>
    </div>
  );
}
