import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

// --- MODAL COMPONENT for displaying the selfie for verification ---
const VerificationModal = ({ team, onClose, onVerify }) => {
    if (!team) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close" onClick={onClose}>&times;</button>
                <h2>Verify Selfie: {team.teamName || team.teamCode}</h2>
                <img src={team.selfie.url} alt={`Selfie for ${team.teamCode}`} style={{ maxWidth: '100%', borderRadius: '5px' }} />
                <div style={{marginTop: '1.5rem'}}>
                    <button onClick={() => onVerify(team.teamCode, true)}>Approve</button>
                    <button onClick={() => onVerify(team.teamCode, false)} className="admin-button">Reject</button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN ADMIN VIEW COMPONENT ---
const AdminView = () => {
    const [allTeams, setAllTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null); // Holds the team whose selfie is being viewed in the modal

    useEffect(() => {
        const fetchInitialTeams = async () => {
            try {
                const response = await fetch(`${API_URL}/api/teams/all`);
                const teamsData = await response.json();
                setAllTeams(teamsData);
            } catch (error) {
                console.error("Failed to fetch teams:", error);
            }
        };
        fetchInitialTeams();

        const handleTeamUpdate = (updatedTeam) => {
            setAllTeams(prevTeams => 
                prevTeams.map(team => 
                    team.teamCode === updatedTeam.teamCode ? updatedTeam : team
                )
            );
        };

        const handleNewSelfie = (teamWithSelfie) => {
            // When a new selfie arrives, just update the main list.
            // The UI will automatically show the "View Selfie" button.
            handleTeamUpdate(teamWithSelfie);
        };

        socket.on('newSelfieForVerification', handleNewSelfie);
        socket.on('teamUpdate', handleTeamUpdate);

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
            setSelectedTeam(null); // Close the modal after action
        } catch (error) {
            console.error("Verification error:", error);
        }
    };
    
    return (
        <div style={{ color: '#EAE0C8', width: '100%' }}>
            <h1>Admin Dashboard</h1>
            
            {/* The Modal for verification will appear here when a team is selected */}
            <VerificationModal team={selectedTeam} onClose={() => setSelectedTeam(null)} onVerify={handleVerification} />

            <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
                    <thead>
                        <tr>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Team</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Status</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Progress</th>
                            <th style={{padding: '8px', borderBottom: '1px solid #C3B091'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allTeams.map(team => {
                            const hasPendingSelfie = team.selfie && team.selfie.url && !team.selfie.isVerified;
                            return (
                                <tr key={team.teamCode}>
                                    <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>{team.teamName || team.teamCode}</td>
                                    <td style={{padding: '8px', borderBottom: '1.5px solid #654321'}}>
                                        {team.endTime ? 'Finished' : (team.selfie.isVerified ? 'In Progress' : (hasPendingSelfie ? 'Pending Verification' : 'Not Started'))}
                                    </td>
                                    <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>
                                        {team.selfie.isVerified || team.endTime ? `${team.currentLocationIndex || 0} / ${team.totalLocations || '?'}` : 'N/A'}
                                    </td>
                                    <td style={{padding: '8px', borderBottom: '1px solid #654321'}}>
                                        {hasPendingSelfie && (
                                            <button 
                                                onClick={() => setSelectedTeam(team)} 
                                                className="notification-button"
                                            >
                                                View Selfie
                                            </button>
                                        )}
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

export default AdminView;

