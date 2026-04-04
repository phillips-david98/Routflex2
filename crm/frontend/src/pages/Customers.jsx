import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Filter, Send, Pencil, Trash2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, RefreshCw, Download } from 'lucide-react';
import Header from '../components/Header.jsx';
import Badge from '../components/Badge.jsx';
import CustomerForm from '../components/CustomerForm.jsx';
import { customersApi, roteirizacaoApi } from '../services/api.js';
import { useSession } from '../contexts/SessionContext.jsx';

const STATUS_OPTS = ['ATIVO','INATIVO','SEM_COORDENADA','PENDENTE_INTEGRACAO'];

// ── Toast hook ────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header"><span className="modal-title">Confirmar ação</span></div>
        <div className="modal-body"><p style={{ fontSize: 14 }}>{message}</p></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const { activeSession } = useSession();
  const activeSessionId = activeSession?.id;
  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [sending, setSending] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDdd, setFilterDdd] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEligible, setFilterEligible] = useState('');
  const [page, setPage] = useState(1);

  const searchTimer = useRef(null);
  const initialMount = useRef(true);
  const prevSessionRef = useRef(activeSessionId);
  const { toasts, show: toast } = useToast();

  // DDDs derivados dos dados carregados (sem hardcode)
  const availableDdds = Array.from(
    new Set(data.items.map(c => String(c.ddd || '')).filter(Boolean))
  ).sort((a, b) => Number(a) - Number(b));

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 15 };
      if (search)         params.search   = search;
      if (filterDdd)      params.ddd      = filterDdd;
      if (filterStatus)   params.status   = filterStatus;
      if (filterEligible !== '') params.eligible = filterEligible;

      const result = await customersApi.list(params);
      const normalized = Array.isArray(result)
        ? {
            items: result,
            total: result.length,
            pages: 1,
            page: 1,
          }
        : {
            items: Array.isArray(result?.items) ? result.items : [],
            total: Number(result?.total || 0),
            pages: Number(result?.pages || 1),
            page: Number(result?.page || p),
          };

      setData(normalized);
      setSelected(new Set());
    } catch {
      toast('Erro ao carregar clientes. Verifique se o backend está rodando.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterDdd, filterStatus, filterEligible, page, activeSessionId]);

  // Trocar sessão → limpar filtros, resetar página, recarregar
  useEffect(() => {
    if (prevSessionRef.current === activeSessionId) return;
    prevSessionRef.current = activeSessionId;
    setSearch('');
    setFilterDdd('');
    setFilterStatus('');
    setFilterEligible('');
    setPage(1);
    setData({ items: [], total: 0, pages: 1, page: 1 });
    setSelected(new Set());
    load(1);
  }, [activeSessionId]);

  useEffect(() => {
    // Pular o timer no mount inicial — o effect [page] já carrega
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(1); }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search, filterDdd, filterStatus, filterEligible]);

  useEffect(() => { load(page); }, [page]);

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === data.items.length) setSelected(new Set());
    else setSelected(new Set(data.items.map(c => c.id)));
  };
  const eligibleSelected = data.items.filter(c => selected.has(c.id) && c.eligible_for_routing);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSave = async (formData) => {
    if (editCustomer) {
      await customersApi.update(editCustomer.id, formData);
      toast('Cliente atualizado com sucesso!');
    } else {
      await customersApi.create(formData);
      toast('Cliente cadastrado com sucesso!');
    }
    setPage(1);
    load(1);
  };

  const openEdit = (c) => { setEditCustomer(c); setFormOpen(true); };
  const openNew  = ()   => { setEditCustomer(null); setFormOpen(true); };

  const handleDelete = (c) => {
    setConfirm({
      message: `Remover o cliente "${c.name}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await customersApi.remove(c.id);
          toast('Cliente removido.');
          setConfirm(null);
          load(page);
        } catch {
          toast('Erro ao remover cliente.', 'error');
          setConfirm(null);
        }
      },
    });
  };

  // ── Roteirização ──────────────────────────────────────────────────────────
  const handleSendToRouting = async () => {
    if (eligibleSelected.length === 0) {
      toast('Selecione clientes aptos para roteirização.', 'warning'); return;
    }
    setSending(true);
    try {
      const clientIds = eligibleSelected.map(c => c.client_id);
      const res = await roteirizacaoApi.sendClients(clientIds);
      toast(`${res.sent} cliente(s) enviado(s) para roteirização!`);
      if (res.rejected_count > 0) toast(`${res.rejected_count} cliente(s) rejeitado(s).`, 'warning');
      load(page);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Erro ao enviar para roteirização.';
      toast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  // ── Routing pill ──────────────────────────────────────────────────────────
  const RoutingPill = ({ eligible }) => (
    <span className={`routing-pill ${eligible ? 'yes' : 'no'}`}>
      {eligible ? <><CheckCircle2 size={10} /> Apto</> : <><XCircle size={10} /> Não apto</>}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header
        title="Clientes"
        subtitle={`${data.total} clientes cadastrados`}
        actions={
          <>
            {selected.size > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSendToRouting}
                disabled={sending || eligibleSelected.length === 0}
                title={eligibleSelected.length === 0 ? 'Nenhum cliente apto selecionado' : `Enviar ${eligibleSelected.length} cliente(s) apto(s)`}
              >
                {sending ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : <Send size={13} />}
                Enviar para Roteirização ({eligibleSelected.length})
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => load(page)}>
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={15} /> Novo Cliente
            </button>
          </>
        }
      />

      <div className="page-body" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="filter-bar">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              className="form-control"
              placeholder="Buscar por nome, CPF/CNPJ, cidade…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <select className="form-control" value={filterDdd} onChange={e => setFilterDdd(e.target.value)}>
            <option value="">Todos os DDDs</option>
            {availableDdds.map(d => <option key={d} value={d}>DDD {d}</option>)}
          </select>
          <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="form-control" value={filterEligible} onChange={e => setFilterEligible(e.target.value)}>
            <option value="">Todos</option>
            <option value="true">Apto roteirização</option>
            <option value="false">Não apto</option>
          </select>
          {(search || filterDdd || filterStatus || filterEligible) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterDdd(''); setFilterStatus(''); setFilterEligible(''); }}>
              Limpar filtros
            </button>
          )}
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div style={{
            background: 'var(--info-bg)',
            borderBottom: '1px solid rgba(33,150,243,.2)',
            padding: '8px 20px',
            fontSize: 12, color: '#1565C0',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <strong>{selected.size}</strong> cliente(s) selecionado(s) —
            <strong>{eligibleSelected.length}</strong> apto(s) para roteirização
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ fontSize: 11 }}>Deselecionar todos</button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div className="loading-overlay"><span className="spinner" /> Carregando…</div>
          ) : data.items.length === 0 ? (
            <div className="empty-state">
              <Filter size={40} />
              <strong>Nenhum cliente encontrado</strong>
              <p>Tente ajustar os filtros ou cadastre um novo cliente.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input type="checkbox" checked={selected.size === data.items.length && data.items.length > 0} onChange={toggleAll} />
                  </th>
                  <th>ID</th>
                  <th>Nome / Empresa</th>
                  <th>CPF / CNPJ</th>
                  <th>DDD</th>
                  <th>Cidade / UF</th>
                  <th>Ultima Visita</th>
                  <th>Vendedor</th>
                  <th>Status</th>
                  <th>Roteirização</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(c => (
                  <tr key={c.id} style={{ background: selected.has(c.id) ? 'rgba(30,58,110,.04)' : undefined }}>
                    <td>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.client_id}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      {c.city && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.city}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{c.cpf_cnpj || '—'}</span>
                    </td>
                    <td>
                      {c.ddd ? (
                        <span style={{
                          background: 'var(--bg-main)', border: '1px solid var(--border)',
                          borderRadius: 4, padding: '2px 7px', fontSize: 12, fontWeight: 600,
                        }}>{c.ddd}</span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {c.city && c.state ? `${c.city} / ${c.state}` : (c.city || c.state || '—')}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{c.seller_name || '—'}</td>
                    <td><Badge status={c.status} /></td>
                    <td>
                      <RoutingPill eligible={c.eligible_for_routing} />
                      {!c.eligible_for_routing && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c.status === 'SEM_COORDENADA' ? 'Sem coordenada' :
                           c.status === 'INATIVO'        ? 'Cliente inativo'  :
                           c.status === 'PENDENTE_INTEGRACAO' ? 'Pend. integração' : '—'}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c)} title="Excluir" style={{ color: 'var(--error)' }}>
                          <Trash2 size={13} />
                        </button>
                        {c.eligible_for_routing && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Enviar para roteirização"
                            style={{ color: 'var(--success)' }}
                            onClick={() => {
                              setSelected(new Set([c.id]));
                              setTimeout(() => handleSendToRouting(), 0);
                            }}
                          >
                            <Send size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {data.pages > 1 && (
          <div className="pagination">
            <span>Exibindo {((page - 1) * 15) + 1}–{Math.min(page * 15, data.total)} de {data.total}</span>
            <div className="pagination-btns">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                );
              })}
              <button className="page-btn" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initialData={editCustomer}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      {/* ── Toasts ─────────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
