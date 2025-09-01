import React, { useState } from 'react';
import './App.css';
import HomeScreen from './components/HomeScreen';
import ParticipantView from './components/ParticipantView';

function App() {
  const [view, setView] = useState('home');
  const [teamData, setTeamData] = useState(null);

  const handleLogin = (data) => {
    setTeamData(data);
    setView('participant');
  };

  const renderView = () => {
    if (view === 'participant') {
      return <ParticipantView teamData={teamData} />;
    }
    return <HomeScreen onLogin={handleLogin} />;
  };

  return <div className="app-container">{renderView()}</div>;
}
export default App;
