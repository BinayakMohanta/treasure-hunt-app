import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

const AdminView = () => {
    const [teams, setTeams] = useState([]);
    const [verificationQueue, setVerificationQueue] = useState([]);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const response = await fetch(`${API_URL}/api/teams/all`);
                const allTeams = await response.json();
                setTeams(allTeams);
                setVerificationQueue(allTeams.filter(t => t.selfie && t.selfie.url && !t.selfie.isVerified && t.selfie.url !== 'REJECTED'));
            } catch (error) {
                console.error("Failed to fetch teams:", error);
            }
        };
        fetchTeams();

        socket.on('newSelfieForVerification', (teamWithSelfie) => {
            setVerificationQueue(prev => {
                if (prev.find(t => t.teamCode === teamWithSelfie.teamCode)) return prev;
                return [...prev, teamWithSelfie];
            });
        });

        socket.on('teamUpdate', (updatedTeam) => {
            setTeams(prevTeams => 
                prevTeams.map(team => 
                    team.teamCode === updatedTeam.teamCode ? { ...team, ...updatedTeam } : team
                )
            );
        });

        return () => {
            socket.off('newSelfieForVerification');
            socket.off('teamUpdate');
        };
    }, []);

    const handleVerification = async (teamCode, isApproved) => {
        try {
            await fetch(`${API_URL}/api/teams/verify-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode, isApproved }),
            });
            setVerificationQueue(prev => prev.filter(t => t.teamCode !== teamCode));
        } catch (error) {
            console.error("Verification error:", error);
        }
    };
    
    return (
        <div style={{ color: '#EAE0C8', width: '100%' }}>
            <h1>Admin Dashboard</h1>

            <div style={{marginBottom: '2rem'}}>
                <h2>Selfie Verification Queue ({verificationQueue.length})</h2>
                {verificationQueue.length > 0 ? (
                    verificationQueue.map(team => (
                        <div key={team.teamCode} style={{ border: '1px solid #C3B091', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <h3>{team.teamName || team.teamCode}</h3>
                            <img src={team.selfie.url} alt={`Selfie for ${team.teamCode}`} style={{ maxWidth: '100%', borderRadius: '5px' }} />
                            <div style={{marginTop: '1rem'}}>
                                <button onClick={() => handleVerification(team.teamCode, true)}>Approve</button>
                                <button onClick={() => handleVerification(team.teamCode, false)} className="admin-button">Reject</button>
                            </div>
                        </div>
                    ))
                ) : <p>No new selfies to verify.</p>}
            </div>

            <div>
                <h2>All Teams Status ({teams.length})</h2>
                <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
                    <thead>
                        <tr>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Team</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Status</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map(team => {
                            const totalLocations = team.totalLocations || (team.routeId && getGameData().routes[team.routeId] ? getGameData().routes[team.routeId].locations.length : '?');
                            return (
                                <tr key={team.teamCode}>
                                    <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>{team.teamName || team.teamCode}</td>
                                    <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>
                                        {team.endTime ? 'Finished' : (team.selfie.isVerified ? 'In Progress' : (team.selfie.url ? (team.selfie.url === 'REJECTED' ? 'Rejected' : 'Pending') : 'Not Started'))}
                                    </td>
                                    <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>
                                        {team.selfie.isVerified ? `${team.currentLocationIndex || 0} / ${totalLocations}` : 'N/A'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Dummy getGameData for AdminView until we can share it from a better place
const getGameData = () => ({
    routes: {
        // This is a simplified placeholder. The actual data is on the server.
        // The server will send the totalLocations with the teamUpdate event.
    }
});

export default AdminView;


