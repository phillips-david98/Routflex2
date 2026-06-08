import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Route as RouteIcon, Send } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { customersApi, roteirizacaoApi } from '../../services/api.js';
import { useSession } from '../../contexts/SessionContext.jsx';
import useRoteirizacaoFilters from './hooks/useRoteirizacaoFilters.js';
import ClientsPreparationTab from './tabs/ClientsPreparationTab.jsx';
import SegmentationTab from './tabs/SegmentationTab.jsx';
import ImportTab from './tabs/ImportTab.jsx';
import TerritoriesTab from './tabs/TerritoriesTab.jsx';
import ValidationTab from './tabs/ValidationTab.jsx';
import SendConfirmationModal from './modals/SendConfirmationModal.jsx';
import { OPERATION_TYPES } from './mocks/segmentationMock.js';

const TABS = [
  { key: 'clients', label: 'Clientes' },
  { key: 'segmentation', label: 'Segmentação' },
  { key: 'import', label: 'Importação' },
  { key: 'territories', label: 'Territórios' },
  { key: 'validation', label: 'Validação' },
];

const SEGMENT_POOL = ['Mercado', 'Farmácia', 'Posto', 'Conveniência', 'Distribuidor', 'Material de Construção', 'Atacado', 'Varejo'];
const CURVE_POOL = ['A', 'B', 'C', 'D'];
const FREQUENCY_POOL = ['Semanal', 'Quinzenal', '2x semana', 'Mensal'];

function deriveTerritory(customer) {
  const direct = customer?.territory_code;
  const raw = String(direct || customer?.seller_name || '').trim();
  const ddd = customer?.ddd ? String(customer.ddd).padStart(2, '0') : '65';
  if (!raw) return `${ddd}-01`;
  const match = raw.match(/^([A-Z]{2})?[\s-]*(\d{2,3})[\s-]*(\d{1,2})$/);
  if (match) return `${match[2]}-${match[3].padStart(2, '0')}`;
  return raw.length <= 8 ? raw : `${ddd}-01`;
}

function nextTerritory(code, ddd) {
  const match = String(code || '').match(/(\d{2,3})-(\d{1,2})/);
  if (!match) return `${ddd || '65'}-03`;
  const next = (Number(match[2]) % 4) + 1;
  return `${match[1]}-${String(next).padStart(2, '0')}`;
}

function enrichCustomer(customer, index) {
  const ddd = customer?.ddd ? String(customer.ddd).padStart(2, '0') : '65';
  const territoryCurrent = deriveTerritory(customer);
  return {
    id: customer.id,
    raw: customer,
    name: customer.name,
    clientId: customer.client_id,
    document: customer.cpf_cnpj,
    ddd: ddd ? `DDD ${ddd}` : '',
    city: customer.city,
    district: customer.neighborhood,
    segment: SEGMENT_POOL[index % SEGMENT_POOL.length],
    curve: CURVE_POOL[index % CURVE_POOL.length],
    frequency: FREQUENCY_POOL[index % FREQUENCY_POOL.length],
    operationType: OPERATION_TYPES[index % OPERATION_TYPES.length],
    hasCoordinate: customer.lat != null && customer.lon != null,
    lat: customer.lat,
    lon: customer.lon,
    territoryCurrent,
    territorySuggested: nextTerritory(territoryCurrent, ddd),
    status: customer.status,
  };
}

export default function RoteirizacaoPage() {
  const { activeSession } = useSession();
  const [activeTab, setActiveTab] = useState('clients');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [integStatus, setIntegStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [modalSelection, setModalSelection] = useState(null);
  const [planningMode, setPlanningMode] = useState('Territorial');

  const enrichedCustomers = useMemo(
    () => customers.map((customer, index) => enrichCustomer(customer, index)),
    [customers],
  );

  const {
    filters,
    options,
    filteredItems,
    hasFilters,
    updateFilter,
    clearFilters,
    applyValidationFilter,
  } = useRoteirizacaoFilters(enrichedCustomers);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, status] = await Promise.all([
        customersApi.list({ per_page: 200 }),
        roteirizacaoApi.status(),
      ]);
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setCustomers(items);
      setIntegStatus(status);
      setSelected(new Set());
      setResult(null);
    } catch (err) {
      setLoadError(err?.response?.data?.error || err?.message || 'Erro ao carregar clientes.');
      console.error('[CRM Roteirizacao] falha ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  useEffect(() => { load(); }, [load]);

  const selectedItems = useMemo(() => {
    const ids = modalSelection || selected;
    return enrichedCustomers.filter((customer) => ids.has(customer.id));
  }, [enrichedCustomers, modalSelection, selected]);

  function toggleSelect(id) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filteredIds = filteredItems.map((item) => item.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
    setSelected((current) => {
      const next = new Set(current);
      filteredIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function openSendModal(singleId) {
    if (singleId) {
      setModalSelection(new Set([singleId]));
      setSendModalOpen(true);
      return;
    }
    if (selected.size === 0) return;
    setModalSelection(null);
    setSendModalOpen(true);
  }

  async function confirmSend() {
    if (selectedItems.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await roteirizacaoApi.sendClients(selectedItems.map((customer) => customer.clientId));
      setResult({ type: 'success', data: res });
      setSendModalOpen(false);
      setModalSelection(null);
      await load();
    } catch (err) {
      setResult({ type: 'error', msg: err?.response?.data?.error || 'Erro ao enviar.' });
    } finally {
      setSending(false);
    }
  }

  function handleValidationFilter(filter) {
    applyValidationFilter(filter);
    setActiveTab('clients');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header
        title="Roteirização"
        subtitle="Central de Preparação de Planejamento"
        actions={(
          <>
            <button className="btn btn-secondary btn-sm" onClick={load} title="Atualizar">
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-primary" onClick={() => openSendModal()} disabled={selected.size === 0 || sending}>
              {sending ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Send size={14} />}
              Enviar {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </>
        )}
      />

      <div className="page-body rf-page-body">
        {loadError && (
          <div className="alert-item error">
            <AlertTriangle size={14} />
            {loadError}
          </div>
        )}

        {integStatus && (
          <div className={`alert-item ${integStatus.connected ? 'success' : 'info'}`}>
            <RouteIcon size={14} />
            {integStatus.message}
          </div>
        )}

        {result && (
          <div className={`alert-item ${result.type}`}>
            {result.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {result.type === 'success'
              ? `${result.data.sent} cliente(s) enviado(s) com sucesso para roteirização.`
              : result.msg}
          </div>
        )}

        <nav className="rf-tabs" aria-label="Roteirização">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'clients' && (
          <ClientsPreparationTab
            loading={loading}
            items={filteredItems}
            selected={selected}
            filters={filters}
            options={options}
            hasFilters={hasFilters}
            onFilterChange={updateFilter}
            onClearFilters={clearFilters}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAllFiltered}
            onOpenSend={openSendModal}
          />
        )}
        {activeTab === 'segmentation' && <SegmentationTab />}
        {activeTab === 'import' && <ImportTab planningMode={planningMode} onPlanningModeChange={setPlanningMode} />}
        {activeTab === 'territories' && <TerritoriesTab />}
        {activeTab === 'validation' && <ValidationTab onApplyFilter={handleValidationFilter} />}
      </div>

      <SendConfirmationModal
        open={sendModalOpen}
        clients={selectedItems}
        planningMode={planningMode}
        activeDdd={activeSession?.ddd}
        sending={sending}
        onCancel={() => { setSendModalOpen(false); setModalSelection(null); }}
        onConfirm={confirmSend}
      />
    </div>
  );
}
