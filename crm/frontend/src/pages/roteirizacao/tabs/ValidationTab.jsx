import { AlertTriangle, CheckCircle2, Filter, Pencil, Wand2 } from 'lucide-react';
import { VALIDATION_ITEMS } from '../mocks/validationMock.js';

const severityIcon = {
  error: AlertTriangle,
  warning: AlertTriangle,
  info: CheckCircle2,
};

export default function ValidationTab({ onApplyFilter }) {
  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title"><AlertTriangle size={16} color="var(--accent)" /> Central de saneamento cadastral</span>
        <span className="rf-chip">Mock funcional</span>
      </div>
      <div className="card-body rf-validation-list">
        {VALIDATION_ITEMS.map((item) => {
          const Icon = severityIcon[item.severity] || AlertTriangle;
          return (
            <article key={item.id} className={`rf-validation-item ${item.severity}`}>
              <div className="rf-validation-icon"><Icon size={16} /></div>
              <div className="rf-validation-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
              <span className="rf-muted-count">{item.affected} clientes</span>
              <div className="rf-card-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onApplyFilter(item.filter)}><Filter size={13} /> Filtrar</button>
                <button type="button" className="btn btn-ghost btn-sm"><Pencil size={13} /> Corrigir</button>
                <button type="button" className="btn btn-secondary btn-sm"><Wand2 size={13} /> Corrigir em lote</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
