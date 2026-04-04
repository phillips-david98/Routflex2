import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { sessionsApi, setActiveSessionId, getStoredSessionId } from '../services/api.js';

const SessionContext = createContext(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const result = await sessionsApi.list();
      const items = Array.isArray(result?.items) ? result.items : (Array.isArray(result) ? result : []);
      setSessions((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        items.forEach((s) => map.set(s.id, s));
        const next = Array.from(map.values());
        // Evitar re-render se a lista não mudou (mesmo IDs na mesma ordem)
        if (prev.length === next.length && prev.every((s, i) => s.id === next[i].id)) return prev;
        return next;
      });
      return { ok: true, items };
    } catch (err) {
      console.error('[SessionContext] Erro ao carregar sessões:', err);
      return { ok: false, items: [] };
    }
  }, []);

  // Restaurar sessão ativa no boot (F5-safe)
  useEffect(() => {
    let cancelled = false;
    console.log('[SessionContext] Boot effect started');

    (async () => {
      setLoading(true);
      let result = await loadSessions();
      if (cancelled) { console.log('[SessionContext] Boot cancelled after first load'); return; }

      // Retry uma vez se falhou (servidor pode estar reiniciando)
      if (!result.ok) {
        console.log('[SessionContext] First load failed, retrying in 1.5s...');
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        result = await loadSessions();
        if (cancelled) return;
      }

      console.log('[SessionContext] Sessions loaded:', { ok: result.ok, count: result.items.length });
      const storedId = getStoredSessionId();
      console.log('[SessionContext] Stored session from localStorage:', storedId);

      if (storedId) {
        const found = result.items.find((s) => s.id === storedId);
        if (found) {
          console.log('[SessionContext] Restoring active session:', found.id);
          setActiveSession((prev) => (prev?.id === found.id ? prev : found));
          setActiveSessionId(found.id);
        } else if (result.ok) {
          // Só limpa localStorage se a API respondeu com sucesso
          // (evita perder referência por falha temporária de rede)
          console.log('[SessionContext] Stored session not in server list, clearing');
          setActiveSessionId(null);
        } else {
          console.log('[SessionContext] API failed — preserving stored session');
        }
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [loadSessions]);

  const createSession = useCallback(async (data) => {
    const session = await sessionsApi.create(data);
    setSessions((prev) => {
      const exists = prev.find((s) => s.id === session.id);
      if (exists) return prev;
      return [...prev, session];
    });
    setActiveSession(session);
    setActiveSessionId(session.id);
    return session;
  }, []);

  const switchSession = useCallback((session) => {
    setActiveSession(session);
    setActiveSessionId(session?.id || null);
  }, []);

  const archiveSession = useCallback(async (id) => {
    const updated = await sessionsApi.update(id, { status: 'ARQUIVADA' });
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setActiveSessionId(null);
    }
    return updated;
  }, [activeSession?.id]);

  const deleteSession = useCallback(async (id) => {
    await sessionsApi.remove(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setActiveSessionId(null);
    }
  }, [activeSession?.id]);

  const value = useMemo(() => ({
    sessions,
    activeSession,
    loading,
    createSession,
    switchSession,
    archiveSession,
    deleteSession,
    refreshSessions: loadSessions,
    hasActiveSession: Boolean(activeSession),
  }), [sessions, activeSession, loading, createSession, switchSession, archiveSession, deleteSession, loadSessions]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
