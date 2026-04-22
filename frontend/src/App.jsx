import React, { useState } from 'react';
import DailyTraining from './pages/DailyTraining';
import MyCases from './pages/MyCases';
import Dashboard from './pages/Dashboard';
import { PlayCircle, FolderOpen, PieChart, Volume2 } from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState('training');

  const renderPage = () => {
    switch (currentPage) {
      case 'training': return <DailyTraining />;
      case 'cases': return <MyCases />;
      case 'dashboard': return <Dashboard />;
      default: return <DailyTraining />;
    }
  };

  return (
    <div className="app-container">
      <nav className="nav-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Volume2 size={24} color="#6366f1" />
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>AgentUp</h2>
        </div>
        <div className="nav-links">
          <a
            className={`nav-link ${currentPage === 'training' ? 'active' : ''}`}
            onClick={() => setCurrentPage('training')}
          >
            <PlayCircle size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            Daily Training
          </a>
          <a
            className={`nav-link ${currentPage === 'cases' ? 'active' : ''}`}
            onClick={() => setCurrentPage('cases')}
          >
            <FolderOpen size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            My Cases
          </a>
          <a
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <PieChart size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            My Dashboard
          </a>
        </div>
        <div className="user-profile">
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>KM</div>
        </div>
      </nav>

      <main className="container">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
