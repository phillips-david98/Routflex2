import { Send, X } from 'lucide-react';

function uniqueLabel(items, key, fallback = 'Não informado') {
  const values = Array.from(new Set(items.map((item) => item[key]).filter(Boolean)));
  if (values.length === 0) return fallback;
  return values.slice(0, 4).join(', ') + (values.length > 4 ? ` +${values.length - 4}` : '');
}

export default function SendConfirmationModal({
  open,
  clients,
  planningMode,
  activeDdd,
  sending,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const territories = uniqueLabel(clients, 'territoryCurrent');
  const suggestedTerritories = uniqueLabel(clients, 'territorySuggested');
  const segments = uniqueLabel(clients, 'segment');
  const curves = uniqueLabel(clients, 'curve');
  const ddds = uniqueLabel(clients, 'ddd', activeDdd ? `DDD ${activeDdd}` : 'Não informado');

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">Enviar para ROUTflex Planning</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="rf-send-summary">
            {[
              ['Clientes selecionados', clients.length],
              ['DDDs envolvidos', ddds],
              ['Territórios atuais', territories],
              ['Territórios sugeridos', suggestedTerritories],
              ['Segmentos', segments],
              ['Curvas', curves],
              ['Modo de Planejamento', planningMode],
            ].map(([label, value]) => (
              <div key={label} className="rf-detail-item">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="alert-item info" style={{ marginTop: 16 }}>
            Esta confirmação preserva o fluxo atual de envio e executa a integração existente após confirmar.
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={sending}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={sending || clients.length === 0}>
            {sending ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Send size={14} />}
            Confirmar Envio
          </button>
        </div>
      </div>
    </div>
  );
}
