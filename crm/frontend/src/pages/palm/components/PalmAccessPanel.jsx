import { Navigation, Search } from 'lucide-react';
import { PALM_TERRITORIES } from '../mocks/palmPlanningMock.js';

export default function PalmAccessPanel({ territory, error, onTerritoryChange, onLoadPlan }) {
  return (
    <div className="palm-access-shell">
      <section className="palm-access-card">
        <div className="palm-access-brand">
          <div className="palm-access-icon"><Navigation size={22} /></div>
          <div>
            <h2>ROUTflex PALM</h2>
            <p>O Palm executa exatamente o plano recebido do ROUTflex Planning.</p>
          </div>
        </div>

        <form onSubmit={onLoadPlan} className="palm-access-form">
          <label htmlFor="palm-territory">Digite o território planejado</label>
          <div className="palm-access-input">
            <Search size={15} />
            <input
              id="palm-territory"
              value={territory}
              onChange={(event) => onTerritoryChange(event.target.value)}
              placeholder="MT 65-04"
              autoComplete="off"
            />
          </div>
          {error && <div className="alert-item warning">{error}</div>}
          <button type="submit" className="btn btn-primary">Carregar Plano</button>
        </form>

        <div className="palm-territory-hints">
          {PALM_TERRITORIES.map((item) => (
            <button key={item} type="button" onClick={() => onTerritoryChange(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
