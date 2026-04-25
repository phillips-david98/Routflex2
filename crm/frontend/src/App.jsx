import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './contexts/SessionContext.jsx';
import SessionGuard from './components/SessionGuard.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Roteirizacao from './pages/Roteirizacao.jsx';
import ControlTower from './pages/ControlTower.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <SessionGuard>
          <Layout>
            <Routes>
              <Route path="/"             element={<Dashboard />} />
              <Route path="/controle"     element={<ControlTower />} />
              <Route path="/clientes"     element={<Customers />} />
              <Route path="/roteirizacao" element={<Roteirizacao />} />
            </Routes>
          </Layout>
        </SessionGuard>
      </SessionProvider>
    </BrowserRouter>
  );
}
