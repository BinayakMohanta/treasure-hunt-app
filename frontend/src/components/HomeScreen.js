import React, { useState } from 'react';

const HomeScreen = ({ onLogin, setView }) => {
    const [teamCode, setTeamCode] = useState('');
    const [error, setError] = useState('');
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

    const handleLogin = async () => {
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
                setError(data.message);
            }
        } catch (err) {
            setError('Could not connect to the server.');
        }
    };

    const handleAdminLogin = () => {
        const password = prompt("Please enter the admin password:");
        // You can change this password to whatever you like.
        if (password === "admin123") {
            setView('admin');
        } else if (password !== null) { // Check if the user clicked "Cancel"
            alert("Incorrect password.");
        }
    };

    return (
        <div className="home-container">
            <div className="title-container">
                <h1 className="main-title">Treasure Hunt</h1>
            </div>
            <div className="login-container">
                <input
                    type="text"
                    className="team-code-input"
                    placeholder="ENTER TEAM CODE"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                />
                <button className="login-button" onClick={handleLogin}>JOIN HUNT</button>
                {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
                <button className="admin-button" onClick={handleAdminLogin}>ADMIN LOGIN</button>
            </div>
        </div>
    );
};

export default HomeScreen;

