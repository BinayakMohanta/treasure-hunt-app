import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QrScanner from 'react-qr-scanner';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

// --- COMPONENT FOR DISPLAYING RIDDLES AND SCANNING ---
const RiddleScreen = ({ teamData, onScanResult }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [errorMessage, setErrorMessage] = useState('');

    const handleScan = (data) => {
        if (data) {
            setIsScanning(false);
            onScanResult(data.text);
        }
    };

    const handleScanError = (err) => {
        console.error(err);
        setErrorMessage("Could not access camera. Please check permissions.");
        setIsScanning(false);
    };

    if (isScanning) {
        return (
            <div>
                <h2>Scan QR Code</h2>
                <div style={{ width: '100%', maxWidth: '400px', margin: 'auto', border: '2px solid #C3B091', borderRadius: '10px', overflow: 'hidden' }}>
                    <QrScanner
                        delay={300}
                        onError={handleScanError}
                        onScan={handleScan}
                        style={{ width: '100%' }}
                        constraints={{ video: { facingMode: "environment" } }}
                    />
                </div>
                <button onClick={() => setIsScanning(false)} className="admin-button" style={{marginTop: '1rem'}}>Cancel</button>
            </div>
        );
    }
    
    return (
        <div className="game-screen" style={{color: '#EAE0C8'}}>
            <h2>The Hunt is On!</h2>
            {errorMessage && <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMessage}</p>}
            <div className="tabs" style={{display: 'flex', marginBottom: '1rem'}}>
                <button onClick={() => setActiveTab('current')} style={{ flex: 1, borderBottom: activeTab === 'current' ? '2px solid #C3B091' : '2px solid transparent' }}>Current Riddle</button>
                <button onClick={() => setActiveTab('past')} style={{ flex: 1, borderBottom: activeTab === 'past' ? '2px solid #C3B091' : '2px solid transparent' }}>Past Riddles</button>
            </div>
            {activeTab === 'current' ? (
                <div className="riddle-card" style={{backgroundColor: '#C3B091', color: 'white', padding: '1.5rem', borderRadius: '10px'}}>
                    <p>{teamData.currentRiddle || "Your first riddle is waiting... Scan the starting QR code!"}</p>
                </div>
            ) : (
                <div className="riddle-card" style={{backgroundColor: '#654321', color: 'white', padding: '1.5rem', borderRadius: '10px', textAlign: 'left'}}>
                    {teamData.riddlesSolved && teamData.riddlesSolved.length > 0 ? (
                        <ul style={{listStyle: 'none', padding: 0}}>
                            {teamData.riddlesSolved.map((item, index) => (
                                <li key={index} style={{marginBottom: '0.5rem'}}><strong>{item.location}:</strong> {item.riddle}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No past riddles yet.</p>
                    )}
                </div>
            )}
            <button onClick={() => { setIsScanning(true); setErrorMessage(''); }} style={{width: '100%', padding: '20px', fontSize: '1.5rem', marginTop: '1rem'}}>Scan Next Clue</button>
        </div>
    );
};

// --- COMPONENT FOR CAPTURING AND UPLOADING SELFIES ---
const SelfieScreen = ({ teamData, onUploadSuccess }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Please take a team selfie for verification.');
    const [isUploading, setIsUploading] = useState(false);
    const webcamRef = useRef(null);

    const capture = useCallback(() => {
        const image = webcamRef.current.getScreenshot();
        setImageSrc(image);
    }, [webcamRef]);

    const retakePhoto = () => setImageSrc(null);

    const handleUpload = async () => {
        if (!imageSrc || isUploading) return;
        setIsUploading(true);
        setStatusMessage('Uploading...');
        try {
            const response = await fetch(`${API_URL}/api/teams/upload-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, imageSrc }),
            });
            if (response.ok) {
                setStatusMessage('Selfie submitted! Waiting for admin approval...');
                onUploadSuccess(); 
            } else {
                 const data = await response.json();
                 setStatusMessage(data.message || 'Upload failed. Please try again.');
                 setIsUploading(false);
            }
        } catch (error) {
            setStatusMessage('Upload failed. Please try again.');
            setIsUploading(false);
        }
    };

    return (
         <div style={{ color: '#EAE0C8' }}>
            <h2>Welcome, {teamData.teamName || teamData.teamCode}!</h2>
            <p style={{ color: '#C3B091', marginBottom: '1.5rem', minHeight: '40px' }}>{statusMessage}</p>
            <div style={{ margin: 'auto', width: '90%', maxWidth: '350px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #654321' }}>
                {imageSrc ? <img src={imageSrc} alt="Team Selfie" /> : <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ width: 400, height: 400, facingMode: "user" }} />}
            </div>
            <div style={{ marginTop: '1.5rem' }}>
                {imageSrc ? (
                    <>
                        <button onClick={handleUpload} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload for Verification'}</button>
                        <button onClick={retakePhoto} className="admin-button" disabled={isUploading}>Retake Photo</button>
                    </>
                ) : (
                    <button onClick={capture}>Capture Photo</button>
                )}
            </div>
        </div>
    );
};


// --- MAIN CONTROLLER COMPONENT FOR PARTICIPANTS ---
const ParticipantView = ({ teamData: initialTeamData }) => {
    const [teamData, setTeamData] = useState(initialTeamData);
    
    // This is the single, robust listener for all real-time updates.
    useEffect(() => {
        // This function handles any update pushed from the server
        const handleTeamUpdate = (updatedTeamFromServer) => {
            // Only update if the message is for this team
            if(updatedTeamFromServer.teamCode === initialTeamData.teamCode) {
                setTeamData(updatedTeamFromServer);
            }
        };
        
        // Listen for the general 'teamUpdate' event
        socket.on('teamUpdate', handleTeamUpdate);

        // This handles the specific case where a selfie is rejected
        const handleSelfieRejected = () => {
             alert("Your selfie was rejected by the admin. Please retake and upload a new one.");
             // Manually reset the selfie part of the state to allow a retake
             setTeamData(prev => ({...prev, selfie: { url: "", isVerified: false }}));
        };
        socket.on(`selfieRejected_${initialTeamData.teamCode}`, handleSelfieRejected);
        
        // Cleanup function to prevent memory leaks
        return () => {
            socket.off('teamUpdate', handleTeamUpdate);
            socket.off(`selfieRejected_${initialTeamData.teamCode}`, handleSelfieRejected);
        };
    }, [initialTeamData.teamCode]); // Only run this effect once per team

    const handleScanResult = async (qrIdentifier) => {
        try {
            const response = await fetch(`${API_URL}/api/teams/scan-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, qrIdentifier }),
            });

            if (!response.ok) {
                 const data = await response.json();
                 alert(data.message || "An error occurred.");
            }
            // No need to manually update state here, the server will push an update via socket.io
        } catch (error) {
            alert("Failed to connect to the server.");
        }
    };
    
    // --- RENDER LOGIC ---

    // Display the final completion screen
    if (teamData.endTime) {
        const startTime = new Date(teamData.startTime);
        const endTime = new Date(teamData.endTime);
        const diff = endTime.getTime() - startTime.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const finalTime = `${hours}h ${minutes}m ${seconds}s`;

        return (
            <div className="game-screen">
                <h2>Congratulations, {teamData.teamName}!</h2>
                <p>You have completed the Treasure Hunt!</p>
                <div className="riddle-card" style={{backgroundColor: '#C3B091', color: 'white', padding: '1.5rem', borderRadius: '10px', marginTop: '1.5rem'}}>
                    <h3>Final Time</h3>
                    <p>{finalTime}</p>
                </div>
            </div>
        );
    }
    
    // This is the main logic gate. It checks the live teamData state.
    if (teamData.selfie && teamData.selfie.isVerified) {
        return <RiddleScreen teamData={teamData} onScanResult={handleScanResult} />;
    } else {
        return <SelfieScreen teamData={teamData} onUploadSuccess={() => setTeamData(prev => ({...prev, selfie: {...(prev.selfie || {}), url: "PENDING"}}))}/>;
    }
};

export default ParticipantView;

