import { useState } from "react";

interface TranslationInputProps {
  onSubmit: (translation: string) => Promise<void>;
}

/** 翻訳文を入力して採点へ送信する UI。送信中はスピナーを表示する。 */
export function TranslationInput({ onSubmit }: TranslationInputProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="日本語を　入力してね"
        className="w-full h-32 p-4 border-2 border-gray-300 rounded-xl
                   focus:border-blue-500 focus:outline-none text-lg resize-none
                   bg-white text-gray-800"
        disabled={submitting}
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        className="mt-2 w-full bg-blue-500 text-white py-3 rounded-xl font-bold text-lg
                   hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            さいてん　しています…
          </span>
        ) : (
          "この　ほんやくで　たたかう！"
        )}
      </button>
    </div>
  );
}
