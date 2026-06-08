import { CalendarDays, ClipboardList, MapPin, Route, Truck, UserRound } from 'lucide-react';
import { MockBadge } from '../../ModuleMockUi.jsx';

const headerFields = [
  ['Território', 'territoryCode', MapPin],
  ['DDD', 'ddd', Route],
  ['Motorista', 'driver', UserRound],
  ['Semana', 'week', CalendarDays],
  ['Ciclo', 'cycle', ClipboardList],
  ['KM Planejado', 'plannedKm', Truck],
  ['Clientes Planejados', 'plannedClients', ClipboardList],
  ['Status', 'status', Route],
];

export default function PalmPlanHeader({ plan }) {
  return (
    <section className="palm-plan-header">
      <div className="palm-plan-title">
        <div>
          <span>Plano recebido do Planning</span>
          <h2>{plan.territoryCode}</h2>
        </div>
        <MockBadge tone="success">{plan.status}</MockBadge>
      </div>

      <div className="palm-plan-fields">
        {headerFields.map(([label, key, Icon]) => (
          <div key={key} className="palm-plan-field">
            <Icon size={15} />
            <span>{label}</span>
            <strong>{key === 'plannedKm' ? `${plan[key]} km` : plan[key]}</strong>
          </div>
        ))}
      </div>

      <div className="palm-plan-meta">
        <span>Supervisor: <strong>{plan.supervisor}</strong></span>
        <span>Veículo: <strong>{plan.vehicle}</strong></span>
        <span>Base Operacional: <strong>{plan.base}</strong></span>
        <span>Tempo Planejado: <strong>{plan.plannedTime}</strong></span>
        <span>Dias Operacionais: <strong>{plan.operationalDays.join(', ')}</strong></span>
      </div>
    </section>
  );
}
