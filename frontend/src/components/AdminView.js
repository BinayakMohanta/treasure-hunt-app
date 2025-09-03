import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

const AdminView = () => {
    // *** NEW STATE MANAGEMENT: Separate state for the master list and the queue ***
    const [allTeams, setAllTeams] = useState([]);
    const [verificationQueue, setVerificationQueue] = useState([]);

    useEffect(() => {
        // Fetch the initial state of all teams when the component loads
        const fetchInitialTeams = async () => {
            try {
                const response = await fetch(`${API_URL}/api/teams/all`);
                const teamsData = await response.json();
                setAllTeams(teamsData);
                // Populate the queue initially with any teams that are already pending
                setVerificationQueue(teamsData.filter(t => t.selfie && t.selfie.url && !t.selfie.isVerified));
            } catch (error) {
                console.error("Failed to fetch teams:", error);
            }
        };
        fetchInitialTeams();

        // Listen for new selfies submitted for verification
        const handleNewSelfie = (teamWithSelfie) => {
            // Add to the queue only if not already present
            setVerificationQueue(prevQueue => {
                const isAlreadyInQueue = prevQueue.some(t => t.teamCode === teamWithSelfie.teamCode);
                return isAlreadyInQueue ? prevQueue : [...prevQueue, teamWithSelfie];
            });
            // Also update the master list of teams
            setAllTeams(prevTeams => 
                prevTeams.map(team => 
                    team.teamCode === teamWithSelfie.teamCode ? teamWithSelfie : team
                )
            );
        };
        
        // Listen for general updates to any team (e.g., after verification or QR scan)
        const handleTeamUpdate = (updatedTeam) => {
            setAllTeams(prevTeams => 
                prevTeams.map(team => 
                    team.teamCode === updatedTeam.teamCode ? updatedTeam : team
                )
            );
        };

        socket.on('newSelfieForVerification', handleNewSelfie);
        socket.on('teamUpdate', handleTeamUpdate);

        // Clean up listeners when the component unmounts
        return () => {
            socket.off('newSelfieForVerification', handleNewSelfie);
            socket.off('teamUpdate', handleTeamUpdate);
        };
    }, []);

    const handleVerification = async (teamCode, isApproved) => {
        try {
            await fetch(`${API_URL}/api/teams/verify-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode, isApproved }),
            });
            // Remove the verified team from the queue
            setVerificationQueue(prevQueue => prevQueue.filter(t => t.teamCode !== teamCode));
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
                <h2>All Teams Status ({allTeams.length})</h2>
                <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
                    <thead>
                        <tr>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Team</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Status</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allTeams.map(team => (
                            <tr key={team.teamCode}>
                                <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>{team.teamName || team.teamCode}</td>
                                <td style={{padding: '8px', borderBottom: '1.5px solid #654321'}}>
                                    {team.endTime ? 'Finished' : (team.selfie.isVerified ? 'In Progress' : (team.selfie.url ? 'Pending Verification' : 'Not Started'))}
                                </td>
                                <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>
                                    {team.selfie.isVerified ? `${team.currentLocationIndex || 0} / ${team.totalLocations || '?'}` : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminView;

