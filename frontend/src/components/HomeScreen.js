import React, { useState } from 'react';

const HomeScreen = ({ onLogin }) => {
    const [teamCode, setTeamCode] = useState('');
    const [error, setError] = useState('');
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

    const handleLogin = async () => {
        setError('');
        if (!teamCode) {
            setError('Please enter a team code.');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/teams/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode }),
            });
            const data = await response.json();
            if (response.ok) {
                onLogin(data);
            } else {
                setError(data.message || 'Invalid team code.');
            }
        } catch (err) {
            setError('Could not connect to the server.');
        }
    };
    
    // Function to handle Enter key press
    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    };

    return (
        <div>
            <h1>Treasure Hunt</h1>
            
            <div className="login-section">
                <h2>Participant Login</h2>
                <input
                    type="text"
                    placeholder="Enter Team Code"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                />
                <button onClick={handleLogin}>Join Hunt</button>
                {error && <p style={{ color: '#ffb3b3', marginTop: '1rem' }}>{error}</p>}
            </div>

            {/* The Admin Login button is here for styling, but is not functional yet */}
            <button className="admin-button">Admin Login</button>
        </div>
    );
};

export default HomeScreen;
