import { Search, Smartphone, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TERRITORIES } from '../mocks/territoriesMock.js';

export default function TerritoriesTab() {
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState(TERRITORIES[0]?.code);

  const territories = useMemo(() => TERRITORIES.filter((territory) => {
    const text = `${territory.ddd} ${territory.code} ${territory.city}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [search]);

  const selected = TERRITORIES.find((territory) => territory.code === selectedCode) || territories[0] || TERRITORIES[0];

  return (
    <div className="rf-territory-layout">
      <aside className="card rf-territory-list">
        <div className="card-header">
          <span className="card-title"><Truck size={16} color="var(--accent)" /> Territórios</span>
        </div>
        <div className="rf-search-inline">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar território" />
        </div>
        <div className="rf-territory-items">
          {territories.map((territory) => (
            <button
              key={`${territory.ddd}-${territory.code}`}
              type="button"
              className={`rf-territory-item${selected?.code === territory.code ? ' active' : ''}`}
              onClick={() => setSelectedCode(territory.code)}
            >
              <span>DDD {territory.ddd}</span>
              <strong>{territory.code}</strong>
              <small>{territory.city}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Território {selected?.code}</span>
          <span className={`rf-chip ${selected?.palmStatus === 'Vinculado' ? 'success' : 'warning'}`}>
            <Smartphone size={12} /> Palm {selected?.palmStatus}
          </span>
        </div>
        <div className="card-body rf-detail-grid">
          {[
            ['DDD', selected?.ddd],
            ['Território', selected?.code],
            ['Motorista', selected?.driver],
            ['Supervisor', selected?.supervisor],
            ['Veículo', selected?.vehicle],
            ['Base Operacional', selected?.base],
            ['Cidade Base', selected?.city],
            ['Frequência', selected?.frequency],
            ['Dias de atendimento', selected?.days],
            ['Quantidade Clientes', selected?.clients],
            ['Clientes sem coordenada', selected?.noCoordinate],
            ['Executor Vinculado', selected?.palm],
          ].map(([label, value]) => (
            <div key={label} className="rf-detail-item">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="rf-detail-item wide">
            <span>Segmentos</span>
            <strong>{selected?.segments.join(', ')}</strong>
          </div>
          <div className="rf-detail-item wide">
            <span>Curvas</span>
            <strong>{selected?.curves.join(', ')}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
