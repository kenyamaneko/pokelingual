import { useState, useRef, useEffect } from "react";
import { questApi } from "../../services/questApi";
import type { ChatContext, ChatMessage } from "../../types";

interface ProfessorChatProps {
  context: ChatContext;
  onClose: () => void;
}

export function ProfessorChat({ context, onClose }: ProfessorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const res = await questApi.chat(context, updatedMessages);
      const professorMessage: ChatMessage = {
        role: "professor",
        content: res.data.reply,
      };
      setMessages([...updatedMessages, professorMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: "professor",
        content: "すまない、うまく　答えられなかった。もう一度　聞いてくれ。",
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
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">はかせに　しつもん</h2>
          <button
            onClick={onClose}
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
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
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
              placeholder="しつもんを　入力してね"
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
              はかせに　聞く
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
