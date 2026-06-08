import { Camera, CheckCircle2, Map, Radio, ShieldCheck } from 'lucide-react';
import { MapPlaceholder, MockBadge, SectionCard } from '../../ModuleMockUi.jsx';

const futureActions = [
  ['Check-in', CheckCircle2],
  ['Check-out', CheckCircle2],
  ['Justificativa', ShieldCheck],
  ['Foto', Camera],
  ['Sincronização', Radio],
];

export default function PalmExecutionPreview() {
  return (
    <div className="palm-side-stack">
      <SectionCard title="Mapa do plano recebido" subtitle="Referência visual do Planning" icon={Map}>
        <MapPlaceholder height={230} />
      </SectionCard>

      <SectionCard title="Execução futura" subtitle="Ações reservadas para próximas fases" icon={ShieldCheck}>
        <div className="palm-future-actions">
          {futureActions.map(([label, Icon]) => (
            <div key={label}>
              <Icon size={15} />
              <span>{label}</span>
              <MockBadge tone="info">Em breve</MockBadge>
            </div>
          ))}
        </div>
        <div className="alert-item info" style={{ marginTop: 14 }}>
          Nesta fase o Palm apenas exibe o plano. Check-in, GPS, foto, checklist e telemetria não foram implementados.
        </div>
      </SectionCard>
    </div>
  );
}
