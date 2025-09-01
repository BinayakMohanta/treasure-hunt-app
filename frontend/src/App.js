import React, { useState } from 'react';
import './App.css';
import HomeScreen from './components/HomeScreen';
import ParticipantView from './components/ParticipantView';
import AdminView from './components/AdminView'; // Make sure to import the new component

function App() {
  const [view, setView] = useState('home'); // Manages which screen is visible: 'home', 'participant', or 'admin'
  const [teamData, setTeamData] = useState(null);

  // This function is called when a participant successfully logs in
  const handleParticipantLogin = (data) => {
    setTeamData(data);
    setView('participant'); // Switch the view to the participant screen
  };

  // This function decides which component to show based on the current 'view' state
  const renderView = () => {
    switch (view) {
      case 'participant':
        return <ParticipantView teamData={teamData} />;
      case 'admin':
        return <AdminView />;
      case 'home':
      default:
        // We pass the `setView` function down to HomeScreen.
        // This allows the "ADMIN LOGIN" button inside HomeScreen to tell this App component
        // to change the view to 'admin'.
        return <HomeScreen onLogin={handleParticipantLogin} setView={setView} />;
    }
  };

  return (
    <div className="app-container">
      {renderView()}
    </div>
  );
}

export default App;

