import { CheckCircle2, Crosshair, Edit3, Layers, Send, SlidersHorizontal } from 'lucide-react';
import Badge from '../../../components/Badge.jsx';

function OperationBadge({ value }) {
  const tone = {
    Venda: ['rgba(30,58,110,.08)', 'var(--primary)'],
    Entrega: ['rgba(0,200,150,.11)', '#00695C'],
    Promotor: ['rgba(33,150,243,.12)', '#1565C0'],
    Merchandising: ['rgba(255,107,44,.12)', 'var(--accent)'],
  }[value] || ['var(--bg-hover)', 'var(--text-secondary)'];

  return (
    <span className="rf-chip" style={{ background: tone[0], color: tone[1] }}>
      {value}
    </span>
  );
}

function CoordBadge({ hasCoordinate, lat, lon }) {
  if (!hasCoordinate) {
    return <span className="rf-chip warning">Sem coord.</span>;
  }
  return (
    <span className="rf-mono" title={`${lat}, ${lon}`}>
      {Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}
    </span>
  );
}

export default function ClientsPreparationTab({
  loading,
  items,
  selected,
  filters,
  options,
  hasFilters,
  onFilterChange,
  onClearFilters,
  onToggleSelect,
  onToggleAll,
  onOpenSend,
}) {
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));

  return (
    <div className="rf-panel">
      <div className="filter-bar rf-filter-bar">
        <select className="form-control" value={filters.segment} onChange={(e) => onFilterChange('segment', e.target.value)}>
          <option value="">Segmento</option>
          {options.segments.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="form-control" value={filters.curve} onChange={(e) => onFilterChange('curve', e.target.value)}>
          <option value="">Curva</option>
          {options.curves.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="form-control" value={filters.city} onChange={(e) => onFilterChange('city', e.target.value)}>
          <option value="">Cidade</option>
          {options.cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="form-control" value={filters.territory} onChange={(e) => onFilterChange('territory', e.target.value)}>
          <option value="">Território</option>
          {options.territories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="form-control" value={filters.operationType} onChange={(e) => onFilterChange('operationType', e.target.value)}>
          <option value="">Tipo de operação</option>
          {options.operationTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <div className="rf-quick-filters">
          {[
            ['withCoordinate', 'Com coordenada'],
            ['withoutCoordinate', 'Sem coordenada'],
            ['active', 'Ativo'],
            ['inactive', 'Inativo'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rf-segment-btn${filters.quick === key ? ' active' : ''}`}
              onClick={() => onFilterChange('quick', filters.quick === key ? '' : key)}
            >
              {label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClearFilters}>
            Limpar filtros
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="rf-selection-bar">
          <strong>{selected.size}</strong> cliente(s) selecionado(s)
          <button type="button" className="btn btn-ghost btn-sm"><Layers size={13} /> Alterar segmento</button>
          <button type="button" className="btn btn-ghost btn-sm"><SlidersHorizontal size={13} /> Alterar curva</button>
          <button type="button" className="btn btn-ghost btn-sm"><Crosshair size={13} /> Corrigir coordenadas</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenSend}><Send size={13} /> Enviar para planejamento</button>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><span className="spinner" /> Carregando carteira...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={40} />
          <strong>Nenhum cliente encontrado</strong>
          <p>Ajuste os filtros para preparar a carteira.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table rf-prep-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
                </th>
                <th>Cliente</th>
                <th>Código</th>
                <th>Cidade</th>
                <th>Bairro</th>
                <th>Segmento</th>
                <th>Curva</th>
                <th>Frequência</th>
                <th>Tipo Operação</th>
                <th>Coordenada</th>
                <th>Território Atual</th>
                <th>Território Sugerido</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ background: selected.has(item.id) ? 'rgba(30,58,110,.045)' : undefined }}>
                  <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggleSelect(item.id)} /></td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{item.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.document || 'Cadastro operacional'}</div>
                  </td>
                  <td><span className="rf-mono">{item.clientId}</span></td>
                  <td>{item.city || '-'}</td>
                  <td>{item.district || '-'}</td>
                  <td><span className="rf-chip">{item.segment}</span></td>
                  <td><span className={`rf-curve curve-${item.curve}`}>{item.curve}</span></td>
                  <td>{item.frequency}</td>
                  <td><OperationBadge value={item.operationType} /></td>
                  <td><CoordBadge hasCoordinate={item.hasCoordinate} lat={item.lat} lon={item.lon} /></td>
                  <td><span className="rf-mono">{item.territoryCurrent}</span></td>
                  <td><span className="rf-suggested-territory">{item.territorySuggested}</span></td>
                  <td><Badge status={item.status} /></td>
                  <td>
                    <div className="rf-row-actions">
                      <button type="button" className="btn btn-ghost btn-sm" title="Editar cliente"><Edit3 size={13} /></button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Editar segmento"><Layers size={13} /></button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Editar curva"><SlidersHorizontal size={13} /></button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Corrigir coordenada"><Crosshair size={13} /></button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Enviar individualmente" onClick={() => onOpenSend(item.id)}><Send size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
