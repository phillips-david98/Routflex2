import { Link2, Pencil, Plus, Tags, Users } from 'lucide-react';
import { CURVES, SEGMENTS } from '../mocks/segmentationMock.js';

export default function SegmentationTab() {
  return (
    <div className="rf-tab-grid">
      <section className="card">
        <div className="card-header">
          <span className="card-title"><Tags size={16} color="var(--accent)" /> Segmentos</span>
          <button type="button" className="btn btn-primary btn-sm"><Plus size={13} /> Criar segmento</button>
        </div>
        <div className="card-body rf-compact-grid">
          {SEGMENTS.map((segment) => (
            <article key={segment.name} className="rf-category-card">
              <div>
                <strong>{segment.name}</strong>
                <span>{segment.clients} clientes</span>
              </div>
              <div className="rf-card-actions">
                <button type="button" className="btn btn-ghost btn-sm"><Pencil size={13} /> Editar</button>
                <button type="button" className="btn btn-ghost btn-sm"><Link2 size={13} /> Vincular</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title"><Users size={16} color="var(--primary)" /> Curvas</span>
          <button type="button" className="btn btn-secondary btn-sm">Alteração em massa</button>
        </div>
        <div className="card-body rf-curves-panel">
          {CURVES.map((curve) => (
            <article key={curve.code} className="rf-curve-row">
              <span className={`rf-curve curve-${curve.code}`}>{curve.code}</span>
              <div>
                <strong>Curva {curve.code}</strong>
                <p>{curve.description}</p>
              </div>
              <span className="rf-muted-count">{curve.clients} clientes</span>
              <button type="button" className="btn btn-ghost btn-sm">Alterar clientes</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
