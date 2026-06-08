import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { MockBadge } from '../ModuleMockUi.jsx';
import PalmAccessPanel from './components/PalmAccessPanel.jsx';
import PalmExecutionPreview from './components/PalmExecutionPreview.jsx';
import PalmPlanHeader from './components/PalmPlanHeader.jsx';
import PalmPlanSchedule from './components/PalmPlanSchedule.jsx';
import { findPalmPlan } from './mocks/palmPlanningMock.js';

export default function PalmPage() {
  const [territory, setTerritory] = useState('MT 65-04');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  function handleLoadPlan(event) {
    event.preventDefault();
    const loadedPlan = findPalmPlan(territory);
    if (!loadedPlan) {
      setPlan(null);
      setError('Território planejado não encontrado nos mocks da Fase 1.');
      return;
    }
    setError('');
    setPlan(loadedPlan);
  }

  function handleReset() {
    setPlan(null);
    setError('');
  }

  return (
    <div>
      <Header
        title="Palm - Rotas"
        subtitle={plan ? 'Executor operacional do plano recebido' : 'Acesso operacional ao plano'}
        actions={plan ? (
          <>
            <MockBadge tone="success">Planning → Palm</MockBadge>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
              <ArrowLeft size={13} /> Trocar território
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlan(findPalmPlan(plan.territoryCode))}>
              <RefreshCw size={13} />
            </button>
          </>
        ) : <MockBadge tone="info">Plano mockado</MockBadge>}
      />

      {!plan ? (
        <PalmAccessPanel
          territory={territory}
          error={error}
          onTerritoryChange={setTerritory}
          onLoadPlan={handleLoadPlan}
        />
      ) : (
        <main className="palm-page-body">
          <PalmPlanHeader plan={plan} />
          <div className="palm-plan-layout">
            <PalmPlanSchedule plan={plan} />
            <PalmExecutionPreview />
          </div>
        </main>
      )}
    </div>
  );
}
