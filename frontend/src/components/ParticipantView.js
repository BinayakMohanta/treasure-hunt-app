import React from 'react';

const ParticipantView = ({ teamData }) => {
    return (
        <div>
            <h2>Welcome, {teamData.teamName || teamData.teamCode}!</h2>
            <p>Your hunt is about to begin.</p>
            <div style={{
                backgroundColor: '#C3B091', color: 'white', padding: '1.5rem',
                borderRadius: '10px', marginTop: '1.5rem'
            }}>
                <p>Your first riddle will appear here after selfie verification!</p>
            </div>
        </div>
    );
};
export default ParticipantView;
