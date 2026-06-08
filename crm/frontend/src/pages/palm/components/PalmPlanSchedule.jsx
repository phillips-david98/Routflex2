import { CalendarClock, ListOrdered } from 'lucide-react';
import { MockBadge, SectionCard } from '../../ModuleMockUi.jsx';

function OperationBadge({ value }) {
  const tone = value === 'Entrega' ? 'success' : value === 'Promotor' ? 'warning' : value === 'Merchandising' ? 'info' : 'info';
  return <MockBadge tone={tone}>{value}</MockBadge>;
}

export default function PalmPlanSchedule({ plan }) {
  return (
    <SectionCard
      title="Clientes planejados"
      subtitle="Sequência recebida do ROUTflex Planning"
      icon={ListOrdered}
      action={<MockBadge tone="info">Semana {plan.week} · Ciclo {plan.cycle}</MockBadge>}
    >
      <div className="palm-week-strip">
        {['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'].map((week) => (
          <span key={week} className={week.endsWith(plan.week) ? 'active' : ''}>{week}</span>
        ))}
      </div>

      <div className="palm-days-grid">
        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].map((day) => (
          <span key={day} className={plan.operationalDays.includes(day) ? 'active' : ''}>{day}</span>
        ))}
      </div>

      <div className="palm-schedule-list">
        {plan.days.map((day) => (
          <article key={day.dayKey} className="palm-day-card">
            <header>
              <div>
                <span>{day.dayKey}</span>
                <strong>{day.label}</strong>
              </div>
              <MockBadge tone="info"><CalendarClock size={12} /> {day.date}</MockBadge>
            </header>

            <div className="table-wrapper">
              <table className="data-table palm-stops-table">
                <thead>
                  <tr>
                    <th>Seq.</th>
                    <th>Cliente</th>
                    <th>Código</th>
                    <th>Bairro</th>
                    <th>Janela</th>
                    <th>Operação</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {day.stops.map((stop) => (
                    <tr key={`${day.dayKey}-${stop.sequence}-${stop.clientCode}`}>
                      <td><span className="palm-sequence">{stop.sequence}</span></td>
                      <td>
                        <strong>{stop.clientName}</strong>
                        <div>{stop.city}</div>
                      </td>
                      <td><span className="palm-mono">{stop.clientCode}</span></td>
                      <td>{stop.district}</td>
                      <td>{stop.plannedWindow}</td>
                      <td><OperationBadge value={stop.operationType} /></td>
                      <td><MockBadge tone="warning">{stop.status}</MockBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
