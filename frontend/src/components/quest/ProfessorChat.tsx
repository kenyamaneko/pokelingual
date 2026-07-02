import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { questApi } from "../../api/questApi";
import { useUsage } from "../../contexts/UsageContext";
import type { ChatContext, ChatMessage } from "../../../../shared/api-types/quest";

interface ProfessorChatProps {
  context: ChatContext;
  onClose: () => void;
}

/**
 * ProfessorChat の仕様文言。テストから import される SSOT。
 */
export const PROFESSOR_CHAT_LABELS = {
  header: "はかせに　しつもん",
  inputPlaceholder: "しつもんを　入力してね",
  sendButton: "はかせに　聞く",
  closeButtonAria: "閉じる",
  errorReply: "すまない、うまく　答えられなかった。もう一度　聞いてくれ。",
} as const;

/**
 * オーキド博士チャットモーダル。クエスト文脈を渡して質問応答 UI を提供する。
 * @param props context / onClose を含む props。
 * @returns 教授チャットモーダルの要素。
 */
export function ProfessorChat({ context, onClose }: ProfessorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { refresh: refreshUsage } = useUsage();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await questApi.replyToChat(context, updatedMessages);
      const professorMessage: ChatMessage = {
        role: "professor",
        content: res.data.reply,
      };
      setMessages([...updatedMessages, professorMessage]);
      refreshUsage();
    } catch (err) {
      // 429 は UsageProvider 側でモーダルが出るので、チャット枠にはエラー文言を出さない
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setMessages(messages);
        return;
      }
      const errorMessage: ChatMessage = {
        role: "professor",
        content: PROFESSOR_CHAT_LABELS.errorReply,
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="professor-chat-title"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 id="professor-chat-title" className="text-lg font-bold text-gray-800">{PROFESSOR_CHAT_LABELS.header}</h2>
          <button
            onClick={onClose}
            aria-label={PROFESSOR_CHAT_LABELS.closeButtonAria}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-8">
              えいごの　ひょうげんや　ポケモンについて
              <br />
              はかせに　聞いてみよう！
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed text-left ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-400">
                はかせが　考えています…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PROFESSOR_CHAT_LABELS.inputPlaceholder}
              disabled={loading}
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-300
                         disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm
                         hover:bg-blue-600 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {PROFESSOR_CHAT_LABELS.sendButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
