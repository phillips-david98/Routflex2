import { useState } from 'react';
import { Bot, ChevronDown, Send } from 'lucide-react';

const STORAGE_KEY = 'routflex_ops_assist_open';

function readInitialState() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function RoutflexAssist() {
  const [open, setOpen] = useState(readInitialState);
  const [noticeVisible, setNoticeVisible] = useState(false);

  function setPanelOpen(nextOpen) {
    setOpen(nextOpen);
    setNoticeVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(nextOpen));
    } catch {
      // A interface continua funcional quando o storage não está disponível.
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setNoticeVisible(true);
  }

  return (
    <div className={`ops-assist${open ? ' is-open' : ''}`}>
      <style>{`
        .ops-assist {
          position: fixed;
          right: 28px;
          bottom: 28px;
          z-index: 900;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 11px;
          pointer-events: none;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .ops-assist-panel,
        .ops-assist-launcher {
          pointer-events: auto;
        }

        .ops-assist-panel {
          width: min(356px, calc(100vw - 28px));
          max-height: min(520px, calc(100vh - 106px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(30, 58, 110, .16);
          border-radius: 18px;
          background: rgba(255, 255, 255, .98);
          box-shadow:
            0 24px 60px rgba(15, 27, 53, .20),
            0 3px 10px rgba(15, 27, 53, .08);
          opacity: 0;
          visibility: hidden;
          transform: translateY(12px) scale(.97);
          transform-origin: bottom right;
          transition:
            opacity .2s ease,
            transform .24s cubic-bezier(.2, .8, .2, 1),
            visibility .2s;
        }

        .ops-assist.is-open .ops-assist-panel {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        .ops-assist-header {
          position: relative;
          min-height: 66px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px 14px;
          color: #fff;
          background:
            radial-gradient(circle at 88% 0%, rgba(43, 80, 152, .9), transparent 45%),
            linear-gradient(135deg, #0F1B35, #1E3A6E);
        }

        .ops-assist-header::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 180, 216, .75), transparent);
        }

        .ops-assist-avatar {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, .18);
          border-radius: 11px;
          background: rgba(255, 255, 255, .09);
          color: #7DE3F2;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
        }

        .ops-assist-heading {
          min-width: 0;
          flex: 1;
        }

        .ops-assist-heading strong {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          letter-spacing: -.01em;
        }

        .ops-assist-heading span {
          display: block;
          margin-top: 2px;
          color: rgba(226, 232, 240, .72);
          font-size: 10px;
        }

        .ops-assist-heading i {
          width: 6px;
          height: 6px;
          display: inline-block;
          border-radius: 50%;
          background: #00C896;
          box-shadow: 0 0 0 3px rgba(0, 200, 150, .13);
        }

        .ops-assist-close {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          color: rgba(255, 255, 255, .72);
          transition: color .15s ease, background .15s ease;
        }

        .ops-assist-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, .1);
        }

        .ops-assist-body {
          padding: 15px 15px 13px;
          overflow-y: auto;
          background:
            linear-gradient(rgba(30, 58, 110, .025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30, 58, 110, .025) 1px, transparent 1px),
            #F8FAFC;
          background-size: 28px 28px;
        }

        .ops-assist-intro {
          position: relative;
          padding: 14px 14px 14px 16px;
          border: 1px solid rgba(30, 58, 110, .10);
          border-radius: 13px;
          background: #fff;
          color: #4B5563;
          font-size: 12px;
          line-height: 1.58;
          box-shadow: 0 4px 12px rgba(15, 27, 53, .045);
        }

        .ops-assist-intro::before {
          content: '';
          position: absolute;
          top: 13px;
          bottom: 13px;
          left: 0;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: linear-gradient(#00B4D8, #1E3A6E);
        }

        .ops-assist-intro strong {
          display: block;
          margin-bottom: 6px;
          color: #1A1A2E;
          font-size: 12px;
        }

        .ops-assist-capabilities {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }

        .ops-assist-capabilities span {
          padding: 4px 8px;
          border: 1px solid rgba(30, 58, 110, .10);
          border-radius: 999px;
          background: rgba(30, 58, 110, .045);
          color: #526176;
          font-size: 9px;
          font-weight: 700;
        }

        .ops-assist-form {
          padding: 12px;
          border-top: 1px solid #E5E7EB;
          background: #fff;
        }

        .ops-assist-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ops-assist-input {
          min-width: 0;
          flex: 1;
          height: 38px;
          padding: 0 11px;
          border: 1px solid #DDE2E9;
          border-radius: 10px;
          outline: none;
          background: #F9FAFB;
          color: #1A1A2E;
          font-size: 11px;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }

        .ops-assist-input:focus {
          border-color: rgba(30, 58, 110, .42);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(30, 58, 110, .07);
        }

        .ops-assist-send {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #1E3A6E;
          color: #fff;
          box-shadow: 0 4px 10px rgba(30, 58, 110, .18);
          transition: transform .15s ease, background .15s ease;
        }

        .ops-assist-send:hover {
          background: #2B5098;
          transform: translateY(-1px);
        }

        .ops-assist-notice {
          max-height: 0;
          overflow: hidden;
          color: #9A5B00;
          font-size: 10px;
          opacity: 0;
          transition: max-height .2s ease, margin .2s ease, opacity .2s ease;
        }

        .ops-assist-notice.is-visible {
          max-height: 30px;
          margin-top: 8px;
          opacity: 1;
        }

        .ops-assist-launcher {
          position: relative;
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 68px;
          padding: 0;
          overflow: visible;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #dffaff;
          cursor: pointer;
          isolation: isolate;
          contain: layout;
          filter: drop-shadow(0 0 8px rgba(17, 132, 255, .24));
          outline: none;
          transition: transform .22s ease, filter .22s ease;
        }

        .ops-assist-launcher::before,
        .ops-assist-launcher::after {
          content: '';
          position: absolute;
          z-index: 0;
          pointer-events: none;
        }

        .ops-assist-launcher::before {
          inset: -5px;
          border-radius: 58% 42% 54% 46% / 45% 56% 44% 55%;
          background:
            radial-gradient(ellipse at 62% 34%, rgba(36, 224, 255, .32), transparent 46%),
            radial-gradient(ellipse at 34% 72%, rgba(14, 99, 255, .26), transparent 50%);
          filter: blur(6px);
          opacity: .68;
          animation: routflex-orb-breathe 7.4s ease-in-out infinite;
        }

        .ops-assist-launcher::after {
          inset: 5px;
          border-radius: 46% 54% 42% 58% / 55% 45% 58% 42%;
          background: radial-gradient(ellipse at 46% 48%, rgba(17, 194, 255, .3), transparent 62%);
          filter: blur(4px);
          opacity: .5;
          animation: routflex-orb-depth 8.8s ease-in-out -2.6s infinite;
        }

        .ops-assist-launcher:hover {
          transform: translateY(-2px) scale(1.018);
          filter: drop-shadow(0 0 11px rgba(25, 176, 255, .36)) brightness(1.1) saturate(1.08);
        }

        .ops-assist-launcher:focus-visible {
          outline: 2px solid rgba(82, 208, 255, .72);
          outline-offset: 3px;
        }

        .ops-assist.is-open .ops-assist-launcher {
          filter: drop-shadow(0 0 11px rgba(25, 176, 255, .36)) brightness(1.1) saturate(1.08);
        }

        .ops-assist-launcher:active {
          transform: translateY(0) scale(.96);
        }

        .routflex-orb-fluid {
          position: absolute;
          inset: 6px;
          z-index: 1;
          overflow: hidden;
          border-radius: 48% 52% 43% 57% / 54% 44% 56% 46%;
          background:
            radial-gradient(ellipse at 42% 34%, rgba(16, 73, 139, .62), transparent 48%),
            radial-gradient(ellipse at 54% 53%, #020b20 0 42%, rgba(2, 11, 32, .9) 57%, rgba(2, 17, 48, .35) 75%, transparent 100%);
          will-change: transform;
          animation: routflex-orb-shell 8.2s ease-in-out infinite;
        }

        .routflex-orb-fluid::before,
        .routflex-orb-fluid::after {
          content: '';
          position: absolute;
          will-change: transform, opacity;
        }

        .routflex-orb-fluid::before {
          width: 66px;
          height: 52px;
          top: -14px;
          left: -19px;
          border-radius: 38% 62% 48% 52% / 56% 38% 62% 44%;
          background: radial-gradient(ellipse at 64% 68%, rgba(59, 232, 255, .92), rgba(0, 154, 255, .68) 34%, rgba(10, 63, 202, .18) 64%, transparent 72%);
          filter: blur(3.5px);
          opacity: .82;
          animation: routflex-orb-flow-a 7.4s ease-in-out infinite;
        }

        .routflex-orb-fluid::after {
          width: 58px;
          height: 68px;
          right: -17px;
          bottom: -24px;
          border-radius: 57% 43% 38% 62% / 42% 58% 44% 56%;
          background: radial-gradient(ellipse at 38% 28%, rgba(32, 218, 255, .8), rgba(0, 102, 255, .64) 37%, rgba(24, 49, 159, .16) 65%, transparent 74%);
          filter: blur(4px);
          opacity: .76;
          animation: routflex-orb-flow-b 9.1s ease-in-out -3s infinite;
        }

        .routflex-orb-energy {
          position: absolute;
          inset: 7px;
          z-index: 2;
          overflow: hidden;
          border-radius: 47% 53% 56% 44% / 43% 58% 42% 57%;
          pointer-events: none;
        }

        .routflex-orb-energy::before,
        .routflex-orb-energy::after {
          content: '';
          position: absolute;
        }

        .routflex-orb-energy::before {
          width: 38px;
          height: 46px;
          left: 8px;
          top: 5px;
          border-radius: 52% 48% 63% 37% / 38% 58% 42% 62%;
          background: radial-gradient(ellipse at 55% 44%, rgba(177, 249, 255, .82), rgba(18, 198, 255, .36) 30%, transparent 67%);
          filter: blur(2px);
          mix-blend-mode: screen;
          opacity: .58;
        }

        .routflex-orb-energy::after {
          width: 31px;
          height: 35px;
          right: 5px;
          bottom: 7px;
          border-radius: 39% 61% 46% 54% / 62% 37% 63% 38%;
          background: radial-gradient(ellipse at 42% 38%, rgba(91, 238, 255, .72), rgba(23, 92, 255, .24) 48%, transparent 72%);
          filter: blur(2.5px);
          mix-blend-mode: screen;
          opacity: .48;
        }

        .routflex-orb-routes {
          position: absolute;
          inset: -8px;
          width: calc(100% + 16px);
          height: calc(100% + 16px);
          overflow: visible;
          pointer-events: none;
          transition: opacity .22s ease;
        }

        .routflex-orb-routes-back {
          z-index: 0;
          opacity: .58;
        }

        .routflex-orb-routes-front {
          z-index: 2;
          opacity: .42;
        }

        .routflex-orb-route,
        .routflex-orb-route-particle {
          fill: none;
          vector-effect: non-scaling-stroke;
        }

        .routflex-orb-route {
          stroke-width: .72;
        }

        .routflex-orb-route-a {
          stroke: rgba(69, 226, 255, .62);
          stroke-dasharray: 28 8 15 12 22 15;
        }

        .routflex-orb-route-b {
          stroke: rgba(30, 147, 255, .5);
          stroke-dasharray: 18 11 30 8 20 13;
        }

        .routflex-orb-route-front-a {
          stroke: rgba(126, 242, 255, .72);
          stroke-width: .9;
          stroke-dasharray: 13 87;
          stroke-dashoffset: -48;
        }

        .routflex-orb-route-front-b {
          stroke: rgba(42, 169, 255, .58);
          stroke-width: .82;
          stroke-dasharray: 9 91;
          stroke-dashoffset: -8;
        }

        .routflex-orb-route-particle {
          stroke-linecap: round;
        }

        .routflex-orb-route-particle-a {
          stroke: #d9fcff;
          stroke-width: 3;
          stroke-dasharray: 1.1 98.9;
          animation: routflex-orb-route-travel 9.6s linear infinite;
        }

        .routflex-orb-route-particle-b {
          stroke: #61eaff;
          stroke-width: 2.5;
          stroke-dasharray: 1 49 1 49;
          animation: routflex-orb-route-travel-reverse 12.4s linear -4.2s infinite;
        }

        .routflex-orb-mark {
          position: relative;
          z-index: 3;
          width: 40px;
          height: 48px;
          overflow: visible;
          pointer-events: none;
          filter: drop-shadow(0 0 4px rgba(75, 230, 255, .78));
        }

        .routflex-orb-mark path {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .routflex-orb-mark-glow {
          stroke: #22cfff;
          stroke-width: 10;
          opacity: .3;
          filter: blur(2.4px);
        }

        .routflex-orb-mark-core {
          stroke: url(#routflex-r-gradient);
          stroke-width: 5.2;
          opacity: .94;
          transition: stroke-width .2s ease, opacity .2s ease;
        }

        .routflex-orb-mark-flow {
          stroke: rgba(241, 255, 255, .95);
          stroke-width: 2.1;
          stroke-dasharray: 13 87;
          stroke-dashoffset: 0;
          opacity: .86;
          animation: routflex-orb-mark-travel 5.2s ease-in-out infinite;
        }

        .ops-assist-launcher:hover .routflex-orb-mark-core,
        .ops-assist.is-open .routflex-orb-mark-core {
          stroke-width: 5.7;
          opacity: 1;
        }

        .ops-assist-launcher:hover .routflex-orb-routes-back,
        .ops-assist.is-open .routflex-orb-routes-back {
          opacity: .72;
        }

        .ops-assist-launcher:hover .routflex-orb-routes-front,
        .ops-assist.is-open .routflex-orb-routes-front {
          opacity: .56;
        }

        @keyframes routflex-orb-breathe {
          0%, 100% { transform: translate3d(-1px, 1px, 0) scale(.94, 1.02); opacity: .45; }
          48% { transform: translate3d(2px, -2px, 0) scale(1.05, .96); opacity: .72; }
        }

        @keyframes routflex-orb-depth {
          0%, 100% { transform: translate3d(2px, -1px, 0) scale(.92, 1.04); opacity: .32; }
          52% { transform: translate3d(-2px, 2px, 0) scale(1.06, .94); opacity: .58; }
        }

        @keyframes routflex-orb-shell {
          0%, 100% { transform: translate3d(0, 1px, 0) scale(.97, 1.02); }
          36% { transform: translate3d(1px, -1px, 0) scale(1.025, .97); }
          72% { transform: translate3d(-1px, 0, 0) scale(.985, 1.015); }
        }

        @keyframes routflex-orb-flow-a {
          0%, 100% { transform: translate3d(-6px, -2px, 0) rotate(-8deg) scale(.9, 1.02); opacity: .66; }
          45% { transform: translate3d(13px, 8px, 0) rotate(7deg) scale(1.12, .92); opacity: .9; }
          72% { transform: translate3d(5px, 13px, 0) rotate(2deg) scale(.98, 1.08); opacity: .76; }
        }

        @keyframes routflex-orb-flow-b {
          0%, 100% { transform: translate3d(4px, 5px, 0) rotate(5deg) scale(1.04, .9); opacity: .62; }
          38% { transform: translate3d(-10px, -8px, 0) rotate(-7deg) scale(.9, 1.12); opacity: .86; }
          70% { transform: translate3d(-4px, -14px, 0) rotate(3deg) scale(1.08, .96); opacity: .72; }
        }

        @keyframes routflex-orb-mark-travel {
          0% { stroke-dashoffset: 0; opacity: .5; }
          48% { opacity: .96; }
          100% { stroke-dashoffset: -100; opacity: .5; }
        }

        @keyframes routflex-orb-route-travel {
          to { stroke-dashoffset: -100; }
        }

        @keyframes routflex-orb-route-travel-reverse {
          to { stroke-dashoffset: 100; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ops-assist-panel,
          .ops-assist-launcher,
          .ops-assist-launcher::before,
          .ops-assist-launcher::after,
          .routflex-orb-fluid,
          .routflex-orb-fluid::before,
          .routflex-orb-fluid::after,
          .routflex-orb-mark-flow,
          .routflex-orb-route-particle {
            animation: none;
            transition: none;
          }
        }

        @media (max-width: 680px) {
          .ops-assist {
            right: 16px;
            bottom: 16px;
          }

          .ops-assist-panel {
            width: min(356px, calc(100vw - 24px));
            max-height: min(500px, calc(100vh - 82px));
          }

          .ops-assist-launcher {
            width: 58px;
            height: 58px;
            flex-basis: 58px;
          }

          .routflex-orb-mark {
            width: 34px;
            height: 42px;
          }
        }
      `}</style>

      <section className="ops-assist-panel" aria-hidden={!open} aria-label="ROUTflex Assist">
        <header className="ops-assist-header">
          <div className="ops-assist-avatar"><Bot size={20} /></div>
          <div className="ops-assist-heading">
            <strong>ROUTflex Assist <i aria-hidden="true" /></strong>
            <span>Assistente operacional · versão visual</span>
          </div>
          <button className="ops-assist-close" type="button" onClick={() => setPanelOpen(false)} aria-label="Recolher assistente">
            <ChevronDown size={18} />
          </button>
        </header>

        <div className="ops-assist-body">
          <div className="ops-assist-intro">
            <strong>Olá. Sou o assistente operacional do ROUTflex OPS.</strong>
            No futuro poderei auxiliar com auditorias, telemetria, análises operacionais e automações inteligentes.
            <br /><br />
            Esta é uma versão visual inicial preparada para futuras integrações.
            <div className="ops-assist-capabilities" aria-label="Áreas futuras">
              <span>Auditoria</span>
              <span>Telemetria</span>
              <span>Análises</span>
              <span>Automações</span>
            </div>
          </div>
        </div>

        <form className="ops-assist-form" onSubmit={handleSubmit}>
          <div className="ops-assist-input-row">
            <input className="ops-assist-input" type="text" placeholder="Digite sua mensagem..." aria-label="Mensagem para o assistente" />
            <button className="ops-assist-send" type="submit" aria-label="Enviar mensagem"><Send size={15} /></button>
          </div>
          <div className={`ops-assist-notice${noticeVisible ? ' is-visible' : ''}`} role="status">
            Assistente ainda não conectado.
          </div>
        </form>
      </section>

      <button
        className="ops-assist-launcher"
        type="button"
        onClick={() => setPanelOpen(!open)}
        aria-label={open ? 'Fechar ROUTflex Assist' : 'Abrir ROUTflex Assist'}
        aria-expanded={open}
      >
        <svg className="routflex-orb-routes routflex-orb-routes-back" viewBox="0 0 84 84" aria-hidden="true" focusable="false">
          <path className="routflex-orb-route routflex-orb-route-a" pathLength="100" d="M6 42 C7 17 66 10 79 36 C88 55 40 76 12 59 C1 52 0 46 6 42 Z" />
          <path className="routflex-orb-route-particle routflex-orb-route-particle-a" pathLength="100" d="M6 42 C7 17 66 10 79 36 C88 55 40 76 12 59 C1 52 0 46 6 42 Z" />
          <path className="routflex-orb-route routflex-orb-route-b" pathLength="100" d="M18 12 C45 1 76 23 72 50 C68 77 25 80 11 54 C1 36 5 20 18 12 Z" />
          <path className="routflex-orb-route-particle routflex-orb-route-particle-b" pathLength="100" d="M18 12 C45 1 76 23 72 50 C68 77 25 80 11 54 C1 36 5 20 18 12 Z" />
        </svg>
        <span className="routflex-orb-fluid" aria-hidden="true" />
        <span className="routflex-orb-energy" aria-hidden="true" />
        <svg className="routflex-orb-routes routflex-orb-routes-front" viewBox="0 0 84 84" aria-hidden="true" focusable="false">
          <path className="routflex-orb-route routflex-orb-route-front-a" pathLength="100" d="M6 42 C7 17 66 10 79 36 C88 55 40 76 12 59 C1 52 0 46 6 42 Z" />
          <path className="routflex-orb-route routflex-orb-route-front-b" pathLength="100" d="M18 12 C45 1 76 23 72 50 C68 77 25 80 11 54 C1 36 5 20 18 12 Z" />
        </svg>
        <svg className="routflex-orb-mark" viewBox="0 0 52 58" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="routflex-r-gradient" x1="12" y1="8" x2="40" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#efffff" />
              <stop offset=".38" stopColor="#53e9ff" />
              <stop offset=".72" stopColor="#159cff" />
              <stop offset="1" stopColor="#b6f8ff" />
            </linearGradient>
          </defs>
          <path className="routflex-orb-mark-glow" d="M16 49 C16 38 15.8 23 18 9 M18 10 C29 5 39 9 39 18 C39 26 31 29 19 27 M23 28 C30 32 36 40 41 49" />
          <path className="routflex-orb-mark-core" d="M16 49 C16 38 15.8 23 18 9 M18 10 C29 5 39 9 39 18 C39 26 31 29 19 27 M23 28 C30 32 36 40 41 49" />
          <path className="routflex-orb-mark-flow" pathLength="100" d="M16 49 C16 38 15.8 23 18 9 M18 10 C29 5 39 9 39 18 C39 26 31 29 19 27 M23 28 C30 32 36 40 41 49" />
        </svg>
      </button>
    </div>
  );
}
