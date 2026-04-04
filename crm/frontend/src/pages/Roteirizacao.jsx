import { useState, useEffect, useCallback } from 'react';
import { Route as RouteIcon, Send, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import Header from '../components/Header.jsx';
import Badge from '../components/Badge.jsx';
import { customersApi, roteirizacaoApi } from '../services/api.js';
import { useSession } from '../contexts/SessionContext.jsx';

export default function Roteirizacao() {
  const { activeSession } = useSession();
  const activeSessionId = activeSession?.id;
  const [eligible, setEligible] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [integStatus, setIntegStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, status] = await Promise.all([
        customersApi.list({ eligible: 'true', per_page: 100 }),
        roteirizacaoApi.status(),
      ]);
      setEligible(data.items);
      setIntegStatus(status);
      setSelected(new Set());
      setResult(null);
    } catch (err) {
      setLoadError(err?.response?.data?.error || err?.message || 'Erro ao carregar clientes elegíveis.');
      console.error('[CRM Roteirizacao] falha ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === eligible.length ? setSelected(new Set()) : setSelected(new Set(eligible.map(c => c.id)));

  const handleSend = async () => {
    const chosen = eligible.filter(c => selected.has(c.id));
    if (!chosen.length) return;
    setSending(true);
    setResult(null);
    try {
      const res = await roteirizacaoApi.sendClients(chosen.map(c => c.client_id));
      setResult({ type: 'success', data: res });
      await load();
    } catch (err) {
      setResult({ type: 'error', msg: err?.response?.data?.error || 'Erro ao enviar.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header
        title="Roteirização"
        subtitle="Enviar clientes elegíveis para o sistema de roteirização ROUTflex"
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
            <button className="btn btn-primary" onClick={handleSend} disabled={selected.size === 0 || sending}>
              {sending ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Send size={14} />}
              Enviar {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </>
        }
      />
      <div className="page-body">
        {/* Load error banner */}
        {loadError && (
          <div className="alert-item error" style={{ marginBottom: 20 }}>
            <AlertTriangle size={14} />
            {loadError}
          </div>
        )}

        {/* Integration status banner */}
        {integStatus && (
          <div className={`alert-item ${integStatus.connected ? 'success' : 'info'}`} style={{ marginBottom: 20 }}>
            <AlertTriangle size={14} />
            {integStatus.message}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`alert-item ${result.type}`} style={{ marginBottom: 20 }}>
            {result.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {result.type === 'success'
              ? `${result.data.sent} cliente(s) enviado(s) com sucesso para roteirização.`
              : result.msg}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RouteIcon size={16} color="var(--accent)" />
              Clientes Aptos
              <span style={{ background: 'var(--success-bg)', color: '#00695C', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99 }}>
                {eligible.length}
              </span>
            </span>
            {eligible.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                {selected.size === eligible.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="loading-overlay"><span className="spinner" /> Carregando…</div>
          ) : eligible.length === 0 ? (
            <div className="empty-state">
              <RouteIcon size={40} />
              <strong>Nenhum cliente apto para roteirização</strong>
              <p>Clientes devem estar com status ATIVO e ter coordenadas válidas.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input type="checkbox" checked={selected.size === eligible.length} onChange={toggleAll} />
                    </th>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>DDD</th>
                    <th>Cidade / UF</th>
                    <th>Coordenadas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.map(c => (
                    <tr key={c.id} style={{ background: selected.has(c.id) ? 'rgba(0,200,150,.06)' : undefined }}>
                      <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                      <td><span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.client_id}</span></td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.ddd || '—'}</td>
                      <td>{c.city && c.state ? `${c.city} / ${c.state}` : '—'}</td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {c.lat?.toFixed(4)}, {c.lon?.toFixed(4)}
                      </td>
                      <td><Badge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
