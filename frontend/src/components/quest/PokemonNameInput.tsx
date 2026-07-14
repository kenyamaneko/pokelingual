import { useState } from "react";

interface PokemonNameInputProps {
  onSubmit: (name: string) => Promise<boolean>;
  onChangeText?: (text: string) => void;
}

/**
 * PokemonNameInput の仕様文言。テストから import される SSOT。
 */
export const POKEMON_NAME_INPUT_LABELS = {
  inputPlaceholder: "ポケモンの名前を入力してね",
  submitButton: "君に　決めた！",
} as const;

/**
 * ポケモン名の入力行 (入力欄 + 送信ボタン)。Enter キー送信 (IME 変換確定中は無視) に対応する。
 * onSubmit が真を返すと入力欄を空にし、偽を返すと入力を残す。
 * @param props onSubmit / onChangeText を含む props。
 * @returns 名前入力行の要素。
 */
export function PokemonNameInput({ onSubmit, onChangeText }: PokemonNameInputProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const accepted = await onSubmit(name);
      if (accepted) setName("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          onChangeText?.(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={POKEMON_NAME_INPUT_LABELS.inputPlaceholder}
        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl
                   focus:border-blue-500 focus:outline-none text-lg bg-white text-gray-800"
        disabled={submitting}
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || submitting}
        className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold
                   hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {submitting ? "…" : POKEMON_NAME_INPUT_LABELS.submitButton}
      </button>
    </div>
  );
}
