import { useNavigate } from "react-router-dom";

/**
 * 利用規約ページ。非営利のファンサイトである旨と規約を掲示する。
 * @returns 利用規約ページの要素。
 */
export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="font-sans min-h-[calc(100vh-var(--header-h))] bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">利用規約</h1>

        <div className="bg-white rounded-2xl shadow p-6 space-y-6 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="font-bold text-gray-800 mb-2">このサイトについて</h2>
            <p>
              PokeLingual（ポケリンガル、以下「本サイト」）は、個人が趣味で運営する非営利のファンサイトです。営利を目的としておらず、ポケモン関連企業（株式会社ポケモン、任天堂株式会社、株式会社ゲームフリーク、株式会社クリーチャーズ）とは一切関係のない、非公式のサイトです。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">著作権・商標について</h2>
            <p>
              「ポケットモンスター」「ポケモン」およびポケモンの名称・画像・キャラクター等に関する著作権・商標権その他の権利は、各権利者に帰属します。本サイトはこれらを英語学習の目的で利用する、非公式のファンによる二次的な創作物です。権利者からのお申し出があった場合は、速やかに対応します。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">目的と免責</h2>
            <p>
              本サイトは英語学習の補助を目的としています。掲載する情報の正確性・完全性を保証するものではなく、本サイトの利用によって生じたいかなる損害についても、運営者は責任を負いません。ご利用は自己責任でお願いします。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">データの取り扱い</h2>
            <p>
              本サイトは、学習の進捗（捕獲したポケモン、スコア等）を保存します。取得した情報を、本サイトの提供以外の目的で利用することはありません。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">規約の変更</h2>
            <p>本規約は、必要に応じて予告なく変更することがあります。</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-800 mb-2">お問い合わせ</h2>
            <p>本サイトに関するお問い合わせは、問い合わせフォームよりお願いします。</p>
          </section>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="mt-6 w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold
                     hover:bg-gray-200 transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
}
