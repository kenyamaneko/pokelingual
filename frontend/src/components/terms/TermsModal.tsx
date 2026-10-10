import { useEffect, useId, type ReactNode } from "react";

interface Props {
  onDismiss: () => void;
}

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className="font-bold text-gray-800 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * 非営利のファンサイトである旨と規約を掲示する利用規約モーダル。
 * @param props onDismiss を含む props。
 * @returns 利用規約モーダルの要素。
 */
export function TermsModal({ onDismiss }: Props) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

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
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="terms-modal-title" className="text-lg font-bold text-gray-800 px-6 pt-6 pb-4 flex-shrink-0">
          利用規約
        </h2>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 text-gray-700 text-sm leading-relaxed">
          <TermsSection title="このサイトについて">
            <p>
              Pokelingual（ポケリンガル、以下「本サイト」）は、個人が趣味で運営する非営利のファンサイトです。営利を目的としておらず、ポケモン関連企業（株式会社ポケモン、任天堂株式会社、株式会社ゲームフリーク、株式会社クリーチャーズ）とは一切関係のない、非公式のサイトです。
            </p>
          </TermsSection>

          <TermsSection title="運営者">
            <p>Ken Yamaneko</p>
          </TermsSection>

          <TermsSection title="著作権・商標について">
            <p>
              「ポケットモンスター」「ポケモン」およびポケモンの名称・画像・キャラクター等に関する著作権・商標権その他の権利は、各権利者に帰属します。本サイトはこれらを英語学習の目的で利用する、非公式のファンによる二次的な創作物です。権利者からのお申し出があった場合は、速やかに対応します。
            </p>
          </TermsSection>

          <TermsSection title="目的と免責">
            <p>
              本サイトは英語学習の補助を目的としています。掲載する情報の正確性・完全性を保証するものではなく、本サイトの利用によって生じたいかなる損害についても、運営者は責任を負いません。ご利用は自己責任でお願いします。
            </p>
          </TermsSection>

          <TermsSection title="データの取り扱い">
            <p>
              本サイトは、学習の進捗（捕獲したポケモン、スコア等）を保存します。取得した情報を、本サイトの提供以外の目的で利用することはありません。
            </p>
          </TermsSection>

          <TermsSection title="規約の変更">
            <p>本規約は、必要に応じて予告なく変更することがあります。</p>
          </TermsSection>

          <TermsSection title="お問い合わせ">
            <p>本サイトに関するお問い合わせは、問い合わせフォームよりお願いします。</p>
          </TermsSection>
        </div>

        <div className="flex-shrink-0 p-6 pt-4">
          <button
            onClick={onDismiss}
            className="w-full bg-red-500 text-white py-3 rounded-2xl font-bold
                       hover:bg-red-600 transition-colors shadow"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
