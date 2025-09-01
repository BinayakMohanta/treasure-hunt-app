import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Connect to the backend server.
// The URL should be the same as your REACT_APP_API_URL.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

const AdminView = () => {
    const [teams, setTeams] = useState([]);
    const [verificationQueue, setVerificationQueue] = useState([]);

    // Fetch all teams when the component loads
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const response = await fetch(`${API_URL}/api/teams/all`);
                const data = await response.json();
                setTeams(data);

                // Populate the initial verification queue
                const pendingVerification = data.filter(team => team.selfie && team.selfie.url && !team.selfie.isVerified);
                setVerificationQueue(pendingVerification);
            } catch (error) {
                console.error("Error fetching teams:", error);
            }
        };
        fetchTeams();
    }, []);

    // Listen for real-time updates from the server
    useEffect(() => {
        // Listen for new selfies that need verification
        socket.on('newSelfieForVerification', (teamWithSelfie) => {
            setVerificationQueue(prevQueue => [...prevQueue, teamWithSelfie]);
            // Update the main teams list as well
            setTeams(prevTeams => prevTeams.map(t => t.teamCode === teamWithSelfie.teamCode ? teamWithSelfie : t));
        });

        // Listen for when a selfie is approved (by this or another admin)
        socket.on('selfieVerified', (verifiedTeam) => {
             // Remove from queue
            setVerificationQueue(prevQueue => prevQueue.filter(team => team.teamCode !== verifiedTeam.teamCode));
            // Update main list
            setTeams(prevTeams => prevTeams.map(t => t.teamCode === verifiedTeam.teamCode ? verifiedTeam : t));
        });

        // Clean up the socket connection when the component unmounts
        return () => {
            socket.off('newSelfieForVerification');
            socket.off('selfieVerified');
        };
    }, []);

    const handleVerification = async (teamCode, isApproved) => {
        try {
            await fetch(`${API_URL}/api/teams/verify-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode, isApproved }),
            });
            // The socket listener above will handle the UI update automatically
        } catch (error) {
            console.error("Error verifying selfie:", error);
        }
    };

    return (
        <div style={{color: '#EAE0C8', width: '100%'}}>
            <h1>Admin Dashboard</h1>

            {/* Verification Queue Section */}
            <div className="verification-queue">
                <h2>Verification Queue ({verificationQueue.length})</h2>
                {verificationQueue.length === 0 ? <p>No selfies to verify.</p> :
                    verificationQueue.map(team => (
                        <div key={team.teamCode} style={{ border: '1px solid #C3B091', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                            <h3>{team.teamName} ({team.teamCode})</h3>
                            <img src={team.selfie.url} alt={`${team.teamName} selfie`} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                            <div style={{marginTop: '1rem'}}>
                                <button onClick={() => handleVerification(team.teamCode, true)} style={{backgroundColor: '#28a745'}}>Approve</button>
                                <button onClick={() => handleVerification(team.teamCode, false)} style={{backgroundColor: '#dc3545'}}>Reject</button>
                            </div>
                        </div>
                    ))
                }
            </div>

            {/* All Teams Status Section */}
            <div className="all-teams-status" style={{marginTop: '2rem'}}>
                <h2>All Teams Status</h2>
                {teams.map(team => (
                    <div key={team.teamCode} style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #654321', padding: '0.5rem 0'}}>
                        <span>{team.teamName}</span>
                        <span style={{color: team.selfie?.isVerified ? '#28a745' : '#ffc107'}}>
                            {team.selfie?.isVerified ? 'Verified' : (team.selfie?.url ? 'Pending' : 'No Selfie')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminView;
