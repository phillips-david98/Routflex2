import { Download, FileSpreadsheet, FileText, PlugZap, Upload } from 'lucide-react';
import { PLANNING_MODES } from '../mocks/segmentationMock.js';

const preValidation = [
  { file: 'carteira_comercial_65.xlsx', rows: 320, valid: 284, pending: 36, status: 'A revisar' },
  { file: 'clientes_entrega_38.csv', rows: 112, valid: 104, pending: 8, status: 'Pré-validado' },
  { file: 'promotores_93.xlsx', rows: 46, valid: 39, pending: 7, status: 'Pendente' },
];

const sources = ['Carteira Comercial', 'Rota de Entrega', 'Promotores', 'Merchandising', 'Distribuição'];

export default function ImportTab({ planningMode, onPlanningModeChange }) {
  return (
    <div className="rf-tab-grid">
      <section className="card">
        <div className="card-header">
          <span className="card-title"><Upload size={16} color="var(--accent)" /> Importação Manual</span>
          <div className="rf-header-actions">
            <button type="button" className="btn btn-secondary btn-sm"><FileSpreadsheet size={13} /> Importar Excel</button>
            <button type="button" className="btn btn-secondary btn-sm"><FileText size={13} /> Importar CSV</button>
            <button type="button" className="btn btn-primary btn-sm"><Download size={13} /> Baixar modelo</button>
          </div>
        </div>
        <div className="card-body">
          <div className="rf-mode-selector">
            <span>Modo de Planejamento</span>
            <div>
              {PLANNING_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rf-segment-btn${planningMode === mode ? ' active' : ''}`}
                  onClick={() => onPlanningModeChange(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Linhas</th>
                  <th>Válidas</th>
                  <th>Pendências</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preValidation.map((row) => (
                  <tr key={row.file}>
                    <td><span style={{ fontWeight: 700 }}>{row.file}</span></td>
                    <td>{row.rows}</td>
                    <td>{row.valid}</td>
                    <td>{row.pending}</td>
                    <td><span className="rf-chip">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title"><PlugZap size={16} color="var(--primary)" /> Importação Operacional</span>
          <span className="rf-chip">Mock visual</span>
        </div>
        <div className="card-body rf-source-list">
          {sources.map((source) => (
            <div key={source} className="rf-source-row">
              <div>
                <strong>{source}</strong>
                <span>Estrutura preparada para futura integração</span>
              </div>
              <span className="rf-chip success">Preparado</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
