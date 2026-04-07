import { useState, useCallback, useEffect } from "react";
import { fetchWithCredentials, API_URL } from "@/lib/fetch";

export type ChatSession = {
  id: string;
  title: string | null;
  status: "active" | "expired" | "closed";
  message_count: number;
  max_messages: number;
  credits_consumed: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

export type ChatSource = {
  legislacao: string;
  artigo: string;
  area: string;
  tema: string;
  score: number;
  content: string;
  resumo: string;
  status: string;
  revogado_por: string | null;
  section_title: string;
};

export type ChatMessageData = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources?: ChatSource[];
};

function getSessionTimestamp(session: ChatSession): number {
  const parsed = Date.parse(session.updated_at || session.created_at);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dedupeSessions(items: ChatSession[]): ChatSession[] {
  const byId = new Map<string, ChatSession>();

  for (const session of items) {
    const existing = byId.get(session.id);
    if (
      !existing ||
      getSessionTimestamp(session) >= getSessionTimestamp(existing)
    ) {
      byId.set(session.id, session);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a),
  );
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/chat/sessions`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        sessions: ChatSession[];
        total: number;
      };
      setSessions(dedupeSessions(data.sessions));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSession = useCallback(async (): Promise<ChatSession | null> => {
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        if (res.status === 402) {
          throw new Error("Créditos insuficientes");
        }
        throw new Error("Erro ao criar sessão");
      }
      const session = (await res.json()) as ChatSession;
      setSessions((prev) => dedupeSessions([session, ...prev]));
      setActiveSession(session);
      setMessages([]);
      return session;
    } catch (err) {
      throw err;
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetchWithCredentials(
        `${API_URL}/ai/chat/sessions/${sessionId}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        session: ChatSession;
        messages: ChatMessageData[];
      };
      setActiveSession(data.session);
      setMessages(data.messages);
    } catch {
      // ignore
    }
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetchWithCredentials(
          `${API_URL}/ai/chat/sessions/${sessionId}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) return false;
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSession?.id === sessionId) {
          setActiveSession(null);
          setMessages([]);
        }
        return true;
      } catch {
        return false;
      }
    },
    [activeSession?.id],
  );

  const addMessage = useCallback((msg: ChatMessageData) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastMessage = useCallback(
    (content: string, sources?: ChatSource[]) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const last = { ...updated[updated.length - 1], content };
        if (sources) last.sources = sources;
        updated[updated.length - 1] = last;
        return updated;
      });
    },
    [],
  );

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    isLoading,
    activeSession,
    messages,
    loadSessions,
    createSession,
    loadSession,
    deleteSession,
    setActiveSession,
    addMessage,
    updateLastMessage,
    setMessages,
  };
}
