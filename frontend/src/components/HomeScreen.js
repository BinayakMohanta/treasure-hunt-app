import React, { useState } from 'react';

const HomeScreen = ({ onLogin }) => {
    const [teamCode, setTeamCode] = useState('');
    const [error, setError] = useState('');
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

    const handleLogin = async () => {
        if (!teamCode) return;
        try {
            const response = await fetch(`${API_URL}/api/teams/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode }),
            });
            const data = await response.json();
            if (response.ok) { onLogin(data); }
            else { setError(data.message); }
        } catch (err) { setError('Could not connect to the server.'); }
    };

    return (
        <div>
            <h1>🗺️ Treasure Hunt</h1>
            <h2>Participant Login</h2>
            <input
                type="text" placeholder="Enter Team Code"
                value={teamCode} onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
            />
            <button onClick={handleLogin}>Join Hunt</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
};
export default HomeScreen;
