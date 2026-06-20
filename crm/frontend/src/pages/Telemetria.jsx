import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  Clock3,
  Filter,
  Gauge,
  LocateFixed,
  Map,
  Milestone,
  MoveRight,
  PauseCircle,
  PlayCircle,
  Route,
  Signal,
  Timer,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MapPlaceholder,
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const events = [
  { time: '07:48', title: 'Saída da base operacional', meta: 'Primeiro sinal registrado no território DDD 65.', tone: 'success', icon: LocateFixed },
  { time: '08:42', title: 'Parada operacional detectada', meta: '16 min próximo ao cliente Farmácia Central.', tone: 'info', icon: PauseCircle },
  { time: '10:18', title: 'Cliente visitado', meta: 'Geocerca compatível com Distribuidora Omega.', tone: 'success', icon: Milestone },
  { time: '12:07', title: 'Desvio de percurso', meta: '3,4 km fora do eixo planejado, sem impacto crítico.', tone: 'warning', icon: MoveRight },
  { time: '16:26', title: 'Última localização recebida', meta: 'Retorno ao corredor logístico principal.', tone: 'info', icon: LocateFixed },
];

const filters = [
  ['Data', '31/05/2026'],
  ['Intervalo', '07:30 - 17:30'],
  ['Consultor', 'Ana Souza'],
  ['Território', 'Cuiabá Norte'],
  ['Status GPS', 'Sinal estável'],
];
const quickRanges = ['Últimas 2h', 'Hoje', 'Ontem', 'Semana'];
const detectedEvents = [
  { type: 'Parada longa', time: '08:42', detail: '16 min em área de cliente', tone: 'warning' },
  { type: 'Desvio detectado', time: '12:07', detail: '3,4 km fora do eixo planejado', tone: 'warning' },
  { type: 'Cliente detectado', time: '10:18', detail: 'Distribuidora Omega validada', tone: 'success' },
  { type: 'Perda de sinal', time: '15:11', detail: '4 min sem pacote GPS', tone: 'danger' },
];

function LegacyTelemetria() {
  return (
    <div>
      <Header
        title="Telemetria"
        subtitle="Auditoria de deslocamento real e eventos operacionais"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionCard title="Filtros operacionais" subtitle="Parâmetros visuais da auditoria" icon={Filter} action={<MockBadge tone="info"><Calendar size={12} /> Hoje</MockBadge>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
            {filters.map(([label, value]) => (
              <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-hover)', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {quickRanges.map((range) => (
                <span key={range} style={{
                  padding: '7px 11px',
                  borderRadius: 999,
                  border: `1px solid ${range === 'Hoje' ? 'rgba(255,107,44,.4)' : 'var(--border)'}`,
                  background: range === 'Hoje' ? 'rgba(255,107,44,.07)' : '#fff',
                  color: range === 'Hoje' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {range}
                </span>
              ))}
            </div>
            <button type="button" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 13px',
              borderRadius: 'var(--radius)',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <PlayCircle size={15} />
              Reproduzir rota
            </button>
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Km total" value="86,4" helper="rota auditada" icon={Route} />
          <MetricCard label="Visitas detectadas" value="9" helper="por geocerca mockada" icon={Milestone} tone="success" />
          <MetricCard label="Desvios" value="2" helper="fora do planejado" icon={MoveRight} tone="warning" />
          <MetricCard label="Tempo produtivo" value="74%" helper="movimento + visitas" icon={Activity} tone="accent" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Mapa auditável do deslocamento" subtitle="Percurso mockado com pontos de parada, início e fim" icon={Map}>
            <MapPlaceholder variant="telemetry" height={430} />
          </SectionCard>

          <SectionCard title="Painel operacional" subtitle="Leitura consolidada do colaborador" icon={Gauge}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Colaborador', 'Ana Souza'],
                ['Território', 'Cuiabá Norte · DDD 65'],
                ['Km rodado', '86,4 km'],
                ['Tempo parado', '1h 18min'],
                ['Em movimento', '5h 42min'],
                ['Primeira localização', '07:48 · Base operacional'],
                ['Última localização', '16:26 · Av. Miguel Sutil'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Timeline de eventos" subtitle="Sequência auditável do dia" icon={Clock3}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {events.map((event) => (
                <TimelineRow key={event.time} {...event} status={event.tone === 'warning' ? 'Atenção' : 'Validado'} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Planejado x executado" subtitle="Comparação visual controlada" icon={Timer}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['Janela da rota', '82%', 'warning'],
                ['Aderência ao percurso', '91%', 'success'],
                ['Cobertura de clientes', '75%', 'accent'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <strong>{value}</strong>
                  </div>
                  <ProgressBar value={Number(value.replace('%', ''))} tone={tone} />
                </div>
              ))}
              <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                Dois desvios foram detectados, mas o trecho executado permanece compatível com a rota produtiva do dia.
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Eventos detectados" subtitle="Lista operacional compacta para auditoria" icon={Signal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))', gap: 10 }}>
            {detectedEvents.map((event) => (
              <div key={event.type} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{event.type}</strong>
                  <MockBadge tone={event.tone}>{event.time}</MockBadge>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{event.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

const journeyEvents = [
  { time: '07:48', title: 'Saída da Base', detail: 'Primeira posição registrada no território.', tone: '#1E3A6E', icon: LocateFixed },
  { time: '08:42', title: 'Cliente Detectado', detail: 'Farmácia Central · permanência de 16 min.', tone: '#00A67E', icon: Milestone },
  { time: '09:10', title: 'Parada Operacional', detail: 'Veículo imóvel por 22 min na região do CPA.', tone: '#E58B00', icon: PauseCircle },
  { time: '10:18', title: 'Cliente Detectado', detail: 'Distribuidora Omega · geocerca compatível.', tone: '#00A67E', icon: Milestone },
  { time: '12:07', title: 'Desvio Detectado', detail: '3,4 km fora do corredor principal.', tone: '#E35B2B', icon: MoveRight },
  { time: '14:36', title: 'Parada Operacional', detail: 'Permanência de 11 min no Jardim Itália.', tone: '#E58B00', icon: PauseCircle },
  { time: '16:26', title: 'Última Localização', detail: 'Av. Miguel Sutil · pacote recebido há 2 min.', tone: '#1688C8', icon: LocateFixed },
];

const telemetryMetrics = [
  { label: 'KM Rodado', value: '86,4 km', helper: 'percurso registrado', icon: Route, color: '#1E3A6E', background: 'rgba(30,58,110,.09)' },
  { label: 'Tempo em Movimento', value: '5h 42min', helper: '66% do intervalo', icon: Activity, color: '#087A60', background: 'rgba(0,200,150,.1)' },
  { label: 'Tempo Parado', value: '1h 18min', helper: '3 paradas relevantes', icon: Timer, color: '#9A5B00', background: 'rgba(255,179,0,.13)' },
  { label: 'Paradas Detectadas', value: '6', helper: 'clientes e operação', icon: PauseCircle, color: '#D85821', background: 'rgba(255,107,44,.1)' },
  { label: 'Última Telemetria', value: '16:26', helper: 'há 2 minutos', icon: Signal, color: '#126DA7', background: 'rgba(30,136,229,.1)' },
];

const telemetrySummary = [
  ['Consultor', 'Ana Souza'],
  ['Território', 'Cuiabá Norte · DDD 65'],
  ['KM rodado', '86,4 km'],
  ['Em movimento', '5h 42min'],
  ['Tempo parado', '1h 18min'],
  ['Última telemetria', '16:26 · há 2 min'],
  ['Última localização', 'Av. Miguel Sutil'],
  ['Status GPS', 'Sinal estável'],
  ['Eventos registrados', '7 eventos'],
];

function TrackingMetric({ item }) {
  const Icon = item.icon;
  return (
    <div className="tracking-metric">
      <div className="tracking-metric-icon" style={{ color: item.color, background: item.background }}>
        <Icon size={17} />
      </div>
      <div>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.helper}</small>
      </div>
    </div>
  );
}

function TrackingTimeline() {
  return (
    <aside className="tracking-panel tracking-timeline-panel">
      <div className="tracking-panel-head">
        <div>
          <strong>Timeline Telemetria</strong>
          <span>Eventos do percurso</span>
        </div>
        <MockBadge tone="info">7 eventos</MockBadge>
      </div>
      <div className="tracking-timeline">
        {journeyEvents.map((event, index) => {
          const Icon = event.icon;
          return (
            <div className="tracking-event" key={`${event.time}-${event.title}`}>
              <time>{event.time}</time>
              <div className="tracking-event-axis">
                <b style={{ borderColor: event.tone, color: event.tone }}><Icon size={10} /></b>
                {index < journeyEvents.length - 1 && <i />}
              </div>
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function TrackingMap() {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapStatus, setMapStatus] = useState('loading');

  const routePoints = [
    { coords: [-15.6098, -56.0986], time: '07:48', label: 'Saída da Base', kind: 'start', mark: 'A' },
    { coords: [-15.6034, -56.0917], time: '08:42', label: 'Farmácia Central', kind: 'client', mark: '1' },
    { coords: [-15.5961, -56.0842], time: '09:10', label: 'Parada Operacional', kind: 'stop', mark: '2' },
    { coords: [-15.5877, -56.0771], time: '10:18', label: 'Distribuidora Omega', kind: 'client', mark: '3' },
    { coords: [-15.5818, -56.0896], time: '12:07', label: 'Ponto de Desvio', marker: false },
    { coords: [-15.5869, -56.1027], time: '14:36', label: 'Parada Jardim Itália', kind: 'stop', mark: '4' },
    { coords: [-15.5928, -56.1041], time: '16:26', label: 'Última Localização', kind: 'latest', mark: 'F' },
  ];

  useEffect(() => {
    let cancelled = false;
    const leafletCssId = 'tracking-leaflet-css';
    const leafletScriptId = 'tracking-leaflet-script';

    function loadLeaflet() {
      const cssPromise = new Promise((resolve, reject) => {
        const existingCss = document.getElementById(leafletCssId);
        if (existingCss?.sheet) {
          resolve();
          return;
        }
        if (existingCss) {
          existingCss.addEventListener('load', resolve, { once: true });
          existingCss.addEventListener('error', reject, { once: true });
          return;
        }

        const link = document.createElement('link');
        link.id = leafletCssId;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
      });

      const scriptPromise = window.L ? Promise.resolve() : new Promise((resolve, reject) => {
        const existing = document.getElementById(leafletScriptId);
        if (existing) {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }

        const script = document.createElement('script');
        script.id = leafletScriptId;
        script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      return Promise.all([cssPromise, scriptPromise]).then(() => window.L);
    }

    loadLeaflet()
      .then((L) => {
        if (cancelled || !L || !mapElementRef.current || mapInstanceRef.current) return;

        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
          preferCanvas: false,
        });
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        const routeCoordinates = routePoints.map((point) => point.coords);
        L.polyline(routeCoordinates, {
          color: '#1E3A6E',
          weight: 5,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        routePoints.forEach((point) => {
          if (point.marker === false) return;
          const icon = L.divIcon({
            className: 'tracking-leaflet-marker-wrap',
            html: `<span class="tracking-leaflet-marker ${point.kind}"><b>${point.mark}</b></span>`,
            iconSize: [32, 38],
            iconAnchor: [16, 34],
            popupAnchor: [0, -32],
          });

          L.marker(point.coords, { icon })
            .addTo(map)
            .bindPopup(`<strong>${point.time} · ${point.label}</strong><br><span>Ponto mockado do percurso operacional.</span>`);
        });

        map.fitBounds(L.latLngBounds(routeCoordinates), { padding: [42, 42] });
        window.setTimeout(() => map.invalidateSize(false), 80);
        setMapStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setMapStatus('error');
      });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <section className="tracking-map-panel">
      <div className="tracking-map-head">
        <div>
          <strong>Percurso Registrado</strong>
          <span>07:48 — 16:26 · Cuiabá Norte</span>
        </div>
        <div className="tracking-legend">
          <span><i className="start" /> Início</span>
          <span><i className="client" /> Cliente</span>
          <span><i className="stop" /> Parada</span>
          <span><i className="latest" /> Última posição</span>
        </div>
      </div>
      <div className="tracking-map">
        <div className="tracking-leaflet-map" ref={mapElementRef} aria-label="Mapa Leaflet do percurso mockado" />
        {mapStatus === 'loading' && <div className="tracking-map-message">Carregando mapa operacional…</div>}
        {mapStatus === 'error' && <div className="tracking-map-message error">Não foi possível carregar o mapa OpenStreetMap.</div>}
        <div className="tracking-map-status"><Signal size={14} /> GPS estável <span>·</span> 48 posições</div>
        <div className="tracking-last-location">
          <LocateFixed size={15} />
          <div><span>Última localização</span><strong>Av. Miguel Sutil, Cuiabá</strong></div>
        </div>
      </div>
    </section>
  );
}

function TrackingSummary() {
  return (
    <aside className="tracking-panel tracking-summary-panel">
      <div className="tracking-panel-head">
        <div><strong>Resumo Operacional</strong><span>Leitura do deslocamento</span></div>
        <Gauge size={17} />
      </div>
      <div className="tracking-gps-card">
        <div><Signal size={17} /></div>
        <section><span>Status GPS</span><strong>Sinal estável</strong><small>Último pacote há 2 min</small></section>
      </div>
      <div className="tracking-summary-list">
        {telemetrySummary.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="tracking-coordinate">
        <LocateFixed size={15} />
        <div><strong>Posição mais recente</strong><span>-15.5928, -56.1041</span></div>
      </div>
    </aside>
  );
}

export default function Telemetria() {
  return (
    <div className="tracking-page">
      <style>{`
        .tracking-page{min-height:100%;background:var(--bg-main)}
        .tracking-content{padding:18px 20px 22px;display:flex;flex-direction:column;gap:14px}
        .tracking-context{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr)) minmax(170px,auto);gap:10px;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm)}
        .tracking-context-item{min-width:0;padding:2px 10px;border-right:1px solid var(--border)}
        .tracking-context-item span,.tracking-summary-list span,.tracking-gps-card span,.tracking-last-location span{display:block;color:var(--text-muted);font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
        .tracking-context-item strong{display:block;margin-top:4px;color:var(--text-primary);font-size:12px}
        .tracking-context-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;padding-left:4px}
        .tracking-play{height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 15px;border-radius:var(--radius);background:var(--primary);color:#fff;font-size:12px;font-weight:800;box-shadow:var(--shadow-sm);white-space:nowrap}
        .tracking-metrics{display:grid;grid-template-columns:repeat(5,minmax(135px,1fr));gap:10px}
        .tracking-metric{min-width:0;display:flex;align-items:center;gap:11px;padding:12px 13px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm)}
        .tracking-metric-icon{width:36px;height:36px;flex:0 0 36px;display:flex;align-items:center;justify-content:center;border-radius:10px}
        .tracking-metric>div:last-child{min-width:0}.tracking-metric span{display:block;color:var(--text-muted);font-size:10px;font-weight:800;text-transform:uppercase}.tracking-metric strong{display:block;margin-top:2px;color:var(--text-primary);font-size:18px;line-height:1.15}
        .tracking-metric small{display:block;margin-top:2px;color:var(--text-muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tracking-workspace{min-height:610px;display:grid;grid-template-columns:minmax(220px,.7fr) minmax(570px,2.35fr) minmax(230px,.75fr);gap:12px;align-items:stretch}
        .tracking-panel,.tracking-map-panel{min-width:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);overflow:hidden}
        .tracking-panel{display:flex;flex-direction:column}.tracking-panel-head,.tracking-map-head{min-height:58px;display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border)}
        .tracking-panel-head>div:first-child,.tracking-map-head>div:first-child{min-width:0}.tracking-panel-head>svg,.tracking-panel-head>span{margin-left:auto;color:var(--text-secondary)}
        .tracking-panel-head strong,.tracking-map-head strong{display:block;color:var(--text-primary);font-size:13px}.tracking-panel-head span,.tracking-map-head span{display:block;margin-top:2px;color:var(--text-muted);font-size:10px}
        .tracking-timeline{flex:1;padding:16px 13px 14px;overflow:auto}.tracking-event{display:grid;grid-template-columns:39px 22px minmax(0,1fr);gap:7px;min-height:75px}
        .tracking-event time{padding-top:3px;color:var(--text-secondary);font-size:11px;font-weight:800}.tracking-event-axis{position:relative;display:flex;justify-content:center}
        .tracking-event-axis b{position:relative;z-index:2;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid;border-radius:50%;background:#fff}
        .tracking-event-axis i{position:absolute;top:22px;bottom:0;width:1px;background:var(--border)}.tracking-event>div:last-child{min-width:0;padding:2px 0 14px}
        .tracking-event strong{color:var(--text-primary);font-size:11px}.tracking-event p{margin:4px 0 0;color:var(--text-muted);font-size:10px;line-height:1.4}
        .tracking-map-panel{display:flex;flex-direction:column}.tracking-map-head{justify-content:space-between}.tracking-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
        .tracking-legend span{display:inline-flex;align-items:center;gap:5px;margin:0;white-space:nowrap}.tracking-legend i{width:7px;height:7px;display:inline-block;border-radius:50%}
        .tracking-legend .start{background:#1E3A6E}.tracking-legend .client{background:#00A67E}.tracking-legend .stop{background:#E58B00}.tracking-legend .latest{background:#1688C8}
        .tracking-map{position:relative;flex:1;min-height:548px;overflow:hidden;background:#EEF3F7}.tracking-leaflet-map{position:absolute;inset:0;z-index:1}
        .tracking-leaflet-map .leaflet-control-zoom{border:1px solid rgba(30,58,110,.16);box-shadow:var(--shadow-sm)}.tracking-leaflet-map .leaflet-control-zoom a{color:var(--text-primary)}
        .tracking-leaflet-map .leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.82)}.tracking-leaflet-marker-wrap{background:none;border:0}
        .tracking-leaflet-marker{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:4px solid #fff;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(15,39,69,.28);color:#fff}
        .tracking-leaflet-marker b{transform:rotate(45deg);font-size:10px;line-height:1}.tracking-leaflet-marker.start{background:#1E3A6E}.tracking-leaflet-marker.client{background:#00A67E}.tracking-leaflet-marker.stop{background:#E58B00}.tracking-leaflet-marker.latest{background:#1688C8}
        .tracking-leaflet-map .leaflet-popup-content{margin:11px 14px;font-size:11px;line-height:1.45}.tracking-leaflet-map .leaflet-popup-content strong{color:var(--text-primary)}
        .tracking-map-message{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;background:#EEF3F7;color:var(--text-muted);font-size:12px;font-weight:700}.tracking-map-message.error{color:#B91C1C}
        .tracking-map-status,.tracking-last-location{position:absolute;z-index:500;display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.94);border:1px solid rgba(30,58,110,.14);box-shadow:var(--shadow-md)}
        .tracking-map-status{top:14px;left:14px;padding:7px 10px;border-radius:999px;color:#087A60;font-size:10px;font-weight:800}.tracking-map-status span{color:var(--text-muted)}
        .tracking-last-location{right:14px;bottom:14px;max-width:245px;padding:10px 12px;border-radius:var(--radius);color:#1688C8}.tracking-last-location strong{display:block;margin-top:2px;color:var(--text-primary);font-size:11px}
        .tracking-summary-panel{padding-bottom:12px}.tracking-gps-card{display:flex;align-items:center;gap:10px;margin:13px;padding:11px;border:1px solid rgba(0,166,126,.2);border-radius:var(--radius);background:rgba(0,166,126,.065)}
        .tracking-gps-card>div{width:34px;height:34px;flex:0 0 34px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#fff;color:#087A60}.tracking-gps-card strong{display:block;margin-top:2px;color:#087A60;font-size:12px}.tracking-gps-card small{display:block;margin-top:2px;color:var(--text-muted);font-size:9px}
        .tracking-summary-list{padding:0 13px}.tracking-summary-list>div{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
        .tracking-summary-list strong{max-width:58%;color:var(--text-primary);font-size:10px;text-align:right;line-height:1.35}.tracking-coordinate{display:flex;align-items:center;gap:9px;margin:13px 13px 0;padding:11px;border-radius:var(--radius);background:var(--bg-hover);color:#1688C8}
        .tracking-coordinate strong,.tracking-coordinate span{display:block;font-size:10px}.tracking-coordinate strong{color:var(--text-primary)}.tracking-coordinate span{margin-top:2px;color:var(--text-muted)}
        @media(max-width:1280px){.tracking-context{grid-template-columns:repeat(4,minmax(110px,1fr))}.tracking-context-actions{grid-column:1/-1;justify-content:space-between}.tracking-workspace{grid-template-columns:minmax(210px,.68fr) minmax(500px,2fr)}.tracking-summary-panel{grid-column:1/-1;display:grid;grid-template-columns:220px 1fr 220px;align-items:start}.tracking-summary-panel .tracking-panel-head{grid-column:1/-1}.tracking-summary-list{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:0 18px}}
        @media(max-width:920px){.tracking-metrics{grid-template-columns:repeat(2,minmax(150px,1fr))}.tracking-workspace{grid-template-columns:1fr}.tracking-map-panel{grid-row:1}.tracking-map{min-height:520px}.tracking-timeline-panel{grid-row:2;max-height:480px}.tracking-summary-panel{grid-row:3;display:flex}}
        @media(max-width:680px){.tracking-content{padding:12px}.tracking-context{grid-template-columns:1fr 1fr}.tracking-context-item{border-right:0}.tracking-context-actions{flex-wrap:wrap}.tracking-play{flex:1}.tracking-metrics{grid-template-columns:1fr}.tracking-map-head{align-items:flex-start;flex-direction:column}.tracking-legend{justify-content:flex-start}}
      `}</style>
      <Header
        title="Telemetria"
        subtitle="Rastreamento e análise de deslocamento operacional"
        actions={<><MockBadge tone="success"><Signal size={12} /> GPS estável</MockBadge><MockBadge tone="info"><Clock3 size={12} /> Última telemetria 16:26</MockBadge></>}
      />
      <main className="tracking-content">
        <section className="tracking-context" aria-label="Contexto da telemetria">
          <div className="tracking-context-item"><span>Consultor</span><strong>Ana Souza</strong></div>
          <div className="tracking-context-item"><span>Território</span><strong>Cuiabá Norte · DDD 65</strong></div>
          <div className="tracking-context-item"><span>Data</span><strong>31/05/2026</strong></div>
          <div className="tracking-context-item"><span>Intervalo</span><strong>07:30 — 17:30</strong></div>
          <div className="tracking-context-actions">
            <MockBadge tone="info"><Calendar size={12} /> Hoje</MockBadge>
            <button className="tracking-play" type="button"><PlayCircle size={14} /> Reproduzir Rota</button>
          </div>
        </section>
        <section className="tracking-metrics" aria-label="Indicadores principais">
          {telemetryMetrics.map((item) => <TrackingMetric item={item} key={item.label} />)}
        </section>
        <section className="tracking-workspace" aria-label="Análise de deslocamento">
          <TrackingTimeline />
          <TrackingMap />
          <TrackingSummary />
        </section>
      </main>
    </div>
  );
}
