import React, { useState } from 'react';
import './App.css';
import HomeScreen from './components/HomeScreen';
import ParticipantView from './components/ParticipantView';
import AdminView from './components/AdminView'; // Import the new component

function App() {
  const [view, setView] = useState('home');
  const [teamData, setTeamData] = useState(null);

  const handleParticipantLogin = (data) => {
    setTeamData(data);
    setView('participant');
  };

  const renderView = () => {
    switch (view) {
      case 'participant':
        return <ParticipantView teamData={teamData} />;
      case 'admin':
        return <AdminView />;
      case 'home':
      default:
        // Pass setView to HomeScreen so it can switch to the admin view
        return <HomeScreen onLogin={handleParticipantLogin} setView={setView} />;
    }
  };

  return <div className="app-container">{renderView()}</div>;
}

export default App;
