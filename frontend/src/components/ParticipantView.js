import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

const videoConstraints = { width: 400, height: 400, facingMode: "user" };

// A new component for the main game screen that appears after verification
const GameScreen = ({ teamData }) => (
    <div>
        <h2>The Hunt is On!</h2>
        <p>Your timer has started. Go to your first location and scan the QR code!</p>
        {/* We will build the QR scanner logic here next */}
        <button style={{width: '100%', padding: '20px', fontSize: '1.5rem', marginTop: '1rem'}}>Scan First Clue</button>
    </div>
);

const ParticipantView = ({ teamData }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Please take a team selfie for verification.');
    const [isVerified, setIsVerified] = useState(teamData.selfie?.isVerified || false);
    const webcamRef = useRef(null);

    // This `useEffect` hook listens for the approval signal from the server
    useEffect(() => {
        // The server will emit a unique event for this team, e.g., 'selfieApproved_TEAM01'
        socket.on(`selfieApproved_${teamData.teamCode}`, () => {
            // When the signal is received, update the state to show the game screen
            setIsVerified(true);
        });

        // It's good practice to clean up the listener when the component is no longer on screen
        return () => {
            socket.off(`selfieApproved_${teamData.teamCode}`);
        };
    }, [teamData.teamCode]);

    const capture = useCallback(() => {
        const image = webcamRef.current.getScreenshot();
        setImageSrc(image);
    }, [webcamRef]);

    const retakePhoto = () => setImageSrc(null);

    // This function now contains the logic to send the image data to the backend
    const handleUpload = async () => {
        if (!imageSrc) return;
        setStatusMessage('Uploading...');
        try {
            // Make the API call to the new endpoint on the server
            await fetch(`${API_URL}/api/teams/upload-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the team's code and the base64 image data
                body: JSON.stringify({ teamCode: teamData.teamCode, imageSrc }),
            });
            setStatusMessage('Selfie submitted! Waiting for admin approval...');
        } catch (error) {
            setStatusMessage('Upload failed. Please try again.');
            console.error("Upload error:", error);
        }
    };

    // If the team is already verified (e.g., they refreshed the page after approval),
    // show the game screen immediately.
    if (isVerified) {
        return <GameScreen teamData={teamData} />;
    }

    // Otherwise, show the entire selfie verification flow
    return (
        <div style={{ color: '#EAE0C8' }}>
            <h2>Welcome, {teamData.teamName || teamData.teamCode}!</h2>
            <p style={{ color: '#C3B091', marginBottom: '1.5rem', minHeight: '40px' }}>{statusMessage}</p>

            <div style={{ margin: 'auto', width: '90%', maxWidth: '350px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #654321' }}>
                {imageSrc ? <img src={imageSrc} alt="Team Selfie" /> : <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={videoConstraints} />}
            </div>
            
            <div style={{ marginTop: '1.5rem' }}>
                {imageSrc ? (
                    <>
                        <button onClick={handleUpload}>Upload for Verification</button>
                        <button onClick={retakePhoto} className="admin-button">Retake Photo</button>
                    </>
                ) : (
                    <button onClick={capture}>Capture Photo</button>
                )}
            </div>
        </div>
    );
};

export default ParticipantView;
