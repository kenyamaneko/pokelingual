interface QuestCardProps {
  description: string;
}

/**
 * 出題の英語説明文を表示するクエストカード。
 * @param props description を含む props。
 * @returns クエストカードの要素。
 */
export function QuestCard({ description }: QuestCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-400">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-gray-700">Who's That Pokemon?</h2>
      </div>
      <div className="bg-gray-50 rounded-xl p-4">
        <p
          className="text-gray-800 text-base leading-relaxed italic"
          data-testid="quest-description"
        >
          "{description}"
        </p>
      </div>
      <p className="text-sm text-gray-500 mt-3 text-center">
        この　えいぶんを　日本語に　ほんやくしよう！
      </p>
    </div>
  );
}
