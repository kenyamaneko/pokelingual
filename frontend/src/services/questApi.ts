import api from "./api";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
  ChatContext,
  ChatMessage,
  ChatResponse,
} from "../types";

export const questApi = {
  newQuest: () => api.get<QuestNewResponse>("/quest/new"),
  scoreTranslation: (translation: string) =>
    api.post<ScoreResponse>("/quest/score", { translation }),
  guessName: (guess: string) =>
    api.post<GuessResponse>("/quest/guess-name", { guess }),
  attemptCapture: () => api.post<CaptureResponse>("/quest/capture"),
  chat: (context: ChatContext, messages: ChatMessage[]) =>
    api.post<ChatResponse>("/quest/chat", { context, messages }),
};
