import { useState } from 'react';
import { Bot, ChevronDown, Send, Sparkles, X } from 'lucide-react';

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
          right: 22px;
          bottom: 22px;
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
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, .14);
          border-radius: 16px;
          background: linear-gradient(145deg, #162A50, #1E3A6E);
          color: #DDF7FB;
          box-shadow:
            0 12px 28px rgba(15, 27, 53, .26),
            inset 0 1px 0 rgba(255, 255, 255, .1);
          transition: transform .2s ease, box-shadow .2s ease, border-radius .2s ease;
        }

        .ops-assist-launcher::before {
          content: '';
          position: absolute;
          inset: -4px;
          z-index: -1;
          border: 1px solid rgba(0, 180, 216, .18);
          border-radius: 20px;
          opacity: .7;
          animation: ops-assist-breathe 3.6s ease-in-out infinite;
        }

        .ops-assist-launcher:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(15, 27, 53, .3);
        }

        .ops-assist.is-open .ops-assist-launcher {
          border-radius: 50%;
        }

        .ops-assist-launcher .ops-assist-spark {
          position: absolute;
          top: 8px;
          right: 8px;
          color: #5DD6E8;
        }

        @keyframes ops-assist-breathe {
          0%, 100% { opacity: .35; transform: scale(.96); }
          50% { opacity: .8; transform: scale(1.04); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ops-assist-panel,
          .ops-assist-launcher,
          .ops-assist-launcher::before {
            animation: none;
            transition: none;
          }
        }

        @media (max-width: 680px) {
          .ops-assist {
            right: 12px;
            bottom: 12px;
          }

          .ops-assist-panel {
            width: min(356px, calc(100vw - 24px));
            max-height: min(500px, calc(100vh - 82px));
          }

          .ops-assist-launcher {
            width: 48px;
            height: 48px;
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
        {open ? <X size={20} /> : <Bot size={21} />}
        {!open && <Sparkles className="ops-assist-spark" size={10} />}
      </button>
    </div>
  );
}
