interface Props {
  onDismiss: () => void;
}

/**
 * 非営利のファンサイトである旨と規約を掲示する利用規約モーダル。
 * @param props onDismiss を含む props。
 * @returns 利用規約モーダルの要素。
 */
export function TermsModal({ onDismiss }: Props) {
  return (
    <div
      data-testid="terms-modal-backdrop"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="terms-modal-title" className="text-lg font-bold text-gray-800 mb-4">
          利用規約
        </h2>

        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-800 mb-2">このサイトについて</h3>
            <p>
              PokeLingual（ポケリンガル、以下「本サイト」）は、個人が趣味で運営する非営利のファンサイトです。営利を目的としておらず、ポケモン関連企業（株式会社ポケモン、任天堂株式会社、株式会社ゲームフリーク、株式会社クリーチャーズ）とは一切関係のない、非公式のサイトです。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">著作権・商標について</h3>
            <p>
              「ポケットモンスター」「ポケモン」およびポケモンの名称・画像・キャラクター等に関する著作権・商標権その他の権利は、各権利者に帰属します。本サイトはこれらを英語学習の目的で利用する、非公式のファンによる二次的な創作物です。権利者からのお申し出があった場合は、速やかに対応します。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">目的と免責</h3>
            <p>
              本サイトは英語学習の補助を目的としています。掲載する情報の正確性・完全性を保証するものではなく、本サイトの利用によって生じたいかなる損害についても、運営者は責任を負いません。ご利用は自己責任でお願いします。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">データの取り扱い</h3>
            <p>
              本サイトは、学習の進捗（捕獲したポケモン、スコア等）を保存します。取得した情報を、本サイトの提供以外の目的で利用することはありません。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">規約の変更</h3>
            <p>本規約は、必要に応じて予告なく変更することがあります。</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">お問い合わせ</h3>
            <p>本サイトに関するお問い合わせは、問い合わせフォームよりお願いします。</p>
          </section>
        </div>

        <button
          onClick={onDismiss}
          className="mt-6 w-full bg-red-500 text-white py-3 rounded-2xl font-bold
                     hover:bg-red-600 transition-colors shadow"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
