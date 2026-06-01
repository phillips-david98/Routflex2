import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { SessionProvider } from './contexts/SessionContext.jsx';
import SessionGuard from './components/SessionGuard.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Roteirizacao from './pages/Roteirizacao.jsx';
import ControlTower from './pages/ControlTower.jsx';
import Palm from './pages/Palm.jsx';
import Ins from './pages/Ins.jsx';
import AuditoriaOperacional from './pages/AuditoriaOperacional.jsx';
import Ocorrencias from './pages/Ocorrencias.jsx';
import DespesasOperacionais from './pages/DespesasOperacionais.jsx';
import SupplyChain from './pages/SupplyChain.jsx';
import EquipesConsultores from './pages/EquipesConsultores.jsx';
import Telemetria from './pages/Telemetria.jsx';
import WhatsAppOperacional from './pages/WhatsAppOperacional.jsx';
import IndicadoresOperacionais from './pages/IndicadoresOperacionais.jsx';
import Integracoes from './pages/Integracoes.jsx';
import CentralLogistica from './pages/CentralLogistica.jsx';

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <SessionProvider>
      <SessionGuard>
        <Layout>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/controle"     element={<ControlTower />} />
            <Route path="/clientes"     element={<Customers />} />
            <Route path="/roteirizacao" element={<Roteirizacao />} />
            <Route path="/palm"         element={<Palm />} />
            <Route path="/ins"          element={<Ins />} />
            <Route path="/auditoria-operacional" element={<AuditoriaOperacional />} />
            <Route path="/ocorrencias" element={<Ocorrencias />} />
            <Route path="/despesas-operacionais" element={<DespesasOperacionais />} />
            <Route path="/supply-chain" element={<SupplyChain />} />
            <Route path="/equipes-consultores" element={<EquipesConsultores />} />
            <Route path="/telemetria" element={<Telemetria />} />
            <Route path="/whatsapp-operacional" element={<WhatsAppOperacional />} />
            <Route path="/indicadores-operacionais" element={<IndicadoresOperacionais />} />
            <Route path="/integracoes" element={<Integracoes />} />
            <Route path="/central-logistica" element={<CentralLogistica />} />
          </Routes>
        </Layout>
      </SessionGuard>
    </SessionProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
